#!/usr/bin/env python3
"""Read-only CloudWatch helper for external-issue RCA (wraps the aws CLI).

CloudWatch bills by the data each query scans, and what drives the scan is the time
range and the log group, not the filter string. So every search here needs a time anchor
(--at) and a bounded window, and the wide ones (insights) report the GB they scanned.

Subcommands
  find     Search a log group for a transaction_id / trace_id around a known time.
           Prints one compact line per event and the trace_id(s) found. With --wait N it
           retries for up to N seconds, for logs that have not been ingested yet.
  show     Print the full JSON of the events whose `message` matches, secrets stripped.
  insights Run a Logs Insights query over a bounded range, wait for it, print the rows
           and the bytes scanned.

Examples
  cw.py find /ecs/payment-stg 76c9780f-fcb3-4df9-98c1-61e44bcbfa57 --at 2026-10-29T14:23:00Z
  cw.py find /ecs/payment-stg <txn> --at <run-time> --wait 180
  cw.py show /ecs/payconnect-stg 5773f554fb0b4cf831b39662af355bf2 --at 2026-10-29T14:23:00Z \
      --messages resulting_curl,response_information,matched_result_map
  cw.py insights /ecs/payconnect-stg --days 7 --query-file q.txt
  cw.py insights /ecs/payconnect-stg --from 2026-10-27T12:00Z --to 2026-10-28T06:00Z --query-file q.txt
"""
import argparse
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone

NOISE = {
    'service_name', 'service_version', 'environment', 'hostname', 'program', 'span_id',
    'trace_flags', 'service.instance.id', 'card_cvv', 'card_expiry_year', 'card_expiry_month',
    'public_key', 'private_key', 'headers', 'Authorization',
}
SECRET_RE = re.compile(
    r'("?(?:apiKey|api_key|access_token|private_api_key|Authorization)\\?"?\s*[:=]\s*\\?"?)'
    r'(Basic |Bearer )?[A-Za-z0-9._\-+/=]{8,}'
)


def aws(args):
    out = subprocess.run(['aws', *args, '--output', 'json'], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f'aws {" ".join(args[:2])} failed: {out.stderr.strip()}')
    return json.loads(out.stdout or 'null')


def epoch_ms(dt):
    return int(dt.timestamp() * 1000)


def parse_at(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)


MAX_WINDOW_MIN = 30
MAX_INSIGHTS_DAYS = 14


def window(args):
    if args.window > MAX_WINDOW_MIN and not args.force:
        sys.exit(f'--window {args.window} min is above {MAX_WINDOW_MIN}: narrow --at instead, '
                 'or pass --force and say why in the report')
    at = parse_at(args.at)
    end = min(at + timedelta(minutes=args.window), datetime.now(timezone.utc))
    return at - timedelta(minutes=args.window), end


# Credentials can sit anywhere, e.g. protobuf headers in payment-stg:
# "Authorization": {"Kind": {"StringValue": "Basic ..."}}, so the scheme alone is enough.
AUTH_SCHEME_RE = re.compile(r'\b(Basic|Bearer)\s+[A-Za-z0-9._\-+/=]{8,}')
JWT_RE = re.compile(r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}')


def redact(text):
    text = SECRET_RE.sub(lambda m: m.group(1) + '[REDACTED]', text)
    text = AUTH_SCHEME_RE.sub(lambda m: m.group(1) + ' [REDACTED]', text)
    return JWT_RE.sub('[REDACTED_JWT]', text)


def as_event(raw):
    """Log lines can carry a GORM/ANSI prefix before the JSON; non-JSON lines come back as raw."""
    i = raw.find('{')
    if i >= 0:
        try:
            d = json.loads(raw[i:])
            if isinstance(d, dict):
                return d
        except ValueError:
            pass
    return {'message': '<raw>', 'raw': raw[:300]}


def fetch(group, needle, start, end, limit):
    messages, token = [], None
    while True:
        cmd = ['logs', 'filter-log-events', '--log-group-name', group,
               '--start-time', str(epoch_ms(start)), '--end-time', str(epoch_ms(end)),
               '--filter-pattern', f'"{needle}"']
        if token:
            cmd += ['--next-token', token]
        page = aws(cmd)
        messages += [e['message'] for e in page.get('events', [])]
        token = page.get('nextToken')
        if not token or len(messages) >= limit:
            return messages[:limit]


def cmd_find(args):
    deadline = time.monotonic() + args.wait
    while True:
        start, end = window(args)
        events = [as_event(m) for m in fetch(args.group, args.needle, start, end, args.limit)]
        if events or time.monotonic() >= deadline:
            break
        print(f'no events yet in {args.group}; logs can take a minute or two to be ingested, retrying in 30 s',
              file=sys.stderr)
        time.sleep(30)
    traces = set()
    for d in events:
        if d.get('trace_id'):
            traces.add(d['trace_id'])
        if d['message'] == '<raw>':
            if not args.raw:
                continue
            print('   RAW', d['raw'][:160])
            continue
        err = redact(str(d.get('error', '')))[:180]
        print(f"{d.get('time', '')[11:23]} {d.get('level', ''):6} {d.get('message')}"
              + (f' | error={err}' if err else ''))
    print(f'\n{len(events)} events in {args.group} [{start:%H:%M}-{end:%H:%M}Z]; trace_id: {sorted(traces) or "none"}')
    if not events:
        print('Nothing found. If the transaction is only seconds old, retry with --wait 180; '
              'otherwise check --at (UTC) before widening the window.')


def cmd_show(args):
    start, end = window(args)
    wanted = set(args.messages.split(',')) if args.messages else None
    for raw in fetch(args.group, args.needle, start, end, args.limit):
        d = as_event(raw)
        if wanted and d.get('message') not in wanted:
            continue
        slim = {k: v for k, v in d.items() if k not in NOISE}
        print(redact(json.dumps(slim, indent=1, ensure_ascii=False))[:args.max_chars])
        print('-----')


def cmd_insights(args):
    query = open(args.query_file).read() if args.query_file else args.query
    if args.since or args.until:
        start = parse_at(args.since) if args.since else None
        end = parse_at(args.until) if args.until else datetime.now(timezone.utc)
        if start is None:
            start = end - timedelta(days=args.days)
    else:
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=args.days)
    if end - start > timedelta(days=MAX_INSIGHTS_DAYS) and not args.force:
        sys.exit(f'range is above {MAX_INSIGHTS_DAYS} days: Insights bills by GB scanned in the range. '
                 'Narrow it, or pass --force and say why in the report')
    qid = aws(['logs', 'start-query', '--log-group-name', args.group,
               '--start-time', str(int(start.timestamp())), '--end-time', str(int(end.timestamp())),
               '--query-string', query])['queryId']
    for _ in range(120):
        res = aws(['logs', 'get-query-results', '--query-id', qid])
        if res['status'] in ('Complete', 'Failed', 'Cancelled', 'Timeout'):
            break
        time.sleep(5)
    if res['status'] != 'Complete':
        sys.exit(f'Insights query ended with status {res["status"]}')
    rows = [{f['field']: f['value'] for f in r if not f['field'].startswith('@ptr')} for r in res['results']]
    for r in rows:
        print(' | '.join(f'{k}={redact(v)[:args.max_chars]}' for k, v in r.items()))
    scanned_gb = res.get('statistics', {}).get('bytesScanned', 0) / 1e9
    print(f'\n{len(rows)} rows ({start:%Y-%m-%d %H:%M}Z to {end:%Y-%m-%d %H:%M}Z, {args.group}); '
          f'scanned {scanned_gb:.2f} GB')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)
    for name in ('find', 'show'):
        s = sub.add_parser(name)
        s.add_argument('group')
        s.add_argument('needle', help='transaction_id, trace_id or any literal string')
        s.add_argument('--at', required=True, help='approximate UTC time of the transaction (ISO 8601)')
        s.add_argument('--window', type=int, default=3,
                       help=f'minutes around --at (default 3, max {MAX_WINDOW_MIN} without --force)')
        s.add_argument('--force', action='store_true', help='allow a window above the cap')
        s.add_argument('--limit', type=int, default=500)
        if name == 'find':
            s.add_argument('--raw', action='store_true', help='also print non-JSON lines (SQL dumps)')
            s.add_argument('--wait', type=int, default=0,
                           help='seconds to keep retrying while logs are not ingested yet (e.g. 180)')
        else:
            s.add_argument('--messages', help='comma-separated `message` values to print')
            s.add_argument('--max-chars', type=int, default=6000)
    s = sub.add_parser('insights')
    s.add_argument('group')
    s.add_argument('--days', type=int, default=7, help=f'lookback (default 7, max {MAX_INSIGHTS_DAYS} without --force)')
    s.add_argument('--from', dest='since', help='range start (UTC ISO 8601), instead of --days')
    s.add_argument('--to', dest='until', help='range end (UTC ISO 8601), default now')
    s.add_argument('--force', action='store_true', help='allow a range above the cap')
    s.add_argument('--query')
    s.add_argument('--query-file')
    s.add_argument('--max-chars', type=int, default=120)
    args = p.parse_args()
    {'find': cmd_find, 'show': cmd_show, 'insights': cmd_insights}[args.cmd](args)


if __name__ == '__main__':
    main()
