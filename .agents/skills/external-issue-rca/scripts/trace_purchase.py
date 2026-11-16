#!/usr/bin/env python3
"""Extract the payment calls a Playwright trace.zip captured: transaction_id, status, error.

Usage: trace_purchase.py <path/to/trace.zip> [--all]

Prints, for every DEUNA purchase/order/payment request in the trace: time (UTC), method,
HTTP status, URL, and from the bodies the transaction_id, order/payment status, processor,
external status and error. --all also lists every non-static request to *.deuna.* hosts.
"""
import json
import re
import sys
import tempfile
import zipfile
from pathlib import Path

INTERESTING = re.compile(r'/(purchase|payments?|orders?/[0-9a-f-]{36}|transactions)(\b|/|\?|$)')
STATIC = ('.js', '.css', '.png', '.svg', '.woff', '.woff2', '.ico', '.jpg', '.webp')


def body(root, part):
    ref = (part or {}).get('_file') or ((part or {}).get('_sha1') and f"resources/{part['_sha1']}")
    if ref and (root / ref).exists():
        return (root / ref).read_text(errors='replace')
    return (part or {}).get('text', '')


def pick(obj, *path):
    for key in path:
        if not isinstance(obj, dict):
            return None
        obj = obj.get(key)
    return obj


def summarize(req_text, res_text):
    out = {}
    try:
        req = json.loads(req_text) if req_text else {}
        out['req.transaction_id'] = req.get('transaction_id')
        out['req.processor_name'] = req.get('processor_name')
        out['req.method_type'] = req.get('method_type')
    except ValueError:
        pass
    try:
        res = json.loads(res_text) if res_text else {}
    except ValueError:
        return {k: v for k, v in out.items() if v}
    order = res.get('order', res) if isinstance(res, dict) else {}
    pay = pick(order, 'payment', 'data') or {}
    out.update({
        'order.status': order.get('status'),
        'payment.id': pay.get('id'),
        'payment.status': pay.get('status'),
        'payment.processor': pay.get('processor'),
        'external_transaction_id': pay.get('external_transaction_id'),
        'external_status': pick(pay, 'authorization_bank_transfer', 'external_transaction_status'),
        'redirect_url': pick(pay, 'next_action', 'authorization_bank_transfer', 'redirect_url'),
        'error': res.get('error') or pay.get('reason') or pick(pay, 'deuna_error', 'code'),
    })
    return {k: v for k, v in out.items() if v not in (None, '', {}, [])}


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    show_all = '--all' in sys.argv
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        zipfile.ZipFile(sys.argv[1]).extractall(root)
        for net in sorted(root.glob('*.network')):
            for line in net.read_text(errors='replace').splitlines():
                ev = json.loads(line)
                snap = ev.get('snapshot') if ev.get('type') == 'resource-snapshot' else None
                if not snap:
                    continue
                url = snap['request']['url']
                if url.split('?')[0].endswith(STATIC):
                    continue
                hit = 'deuna' in url and INTERESTING.search(url)
                if not hit and not (show_all and 'deuna' in url):
                    continue
                print(snap.get('startedDateTime', '')[:23], snap['request']['method'],
                      snap['response']['status'], url[:150])
                if hit:
                    info = summarize(body(root, snap['request'].get('postData')),
                                     body(root, snap['response'].get('content')))
                    for k, v in info.items():
                        print(f'    {k}: {json.dumps(v, ensure_ascii=False)[:300]}')


if __name__ == '__main__':
    main()
