#!/usr/bin/env ts-node
/**
 * Adds a `@service_<code>` tag to every test listed in the inventory CSV.
 *
 * The CSV (`test_id,title,file,service,spec_tags,services_called`) is the source of truth:
 * `service` is the primary service of the test case. The tag is written in the `tag` option
 * of the `test()` call (never in the title, so the Zephyr ID extraction is not affected).
 *
 * Usage:
 *   npx ts-node scripts/add-service-tags.ts --dry-run                 # report only, no writes
 *   npx ts-node scripts/add-service-tags.ts                           # apply to every row
 *   npx ts-node scripts/add-service-tags.ts --prefix RECON,ECOM       # batch by ID prefix
 *   npx ts-node scripts/add-service-tags.ts --ids PI-T629,PI-T630     # specific test cases
 *   npx ts-node scripts/add-service-tags.ts --check                   # exit 1 if any tag is
 *                                                                      missing or differs
 *   npx ts-node scripts/add-service-tags.ts --csv path/to/file.csv --report out.json
 *
 * Behaviour:
 *   - Idempotent: a test that already has the expected tag is left alone.
 *   - If a test has a different `@service_*` tag, it is replaced (the CSV wins).
 *   - Rows with an empty `service` are skipped and listed in the report.
 *   - Tests that cannot be edited safely (options passed by reference, test not found) are
 *     reported as `manual` and never touched.
 *   - Only files that changed are written. Run `npx prettier --write` on them afterwards.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  Project,
  QuoteKind,
  SyntaxKind,
  type ArrayLiteralExpression,
  type CallExpression,
} from 'ts-morph';

const REPO_ROOT = path.resolve(__dirname, '..');
const TAG_PREFIX = '@service_';
const SERVICE_TAG_RE = /^@service_[a-z0-9_]+$/;
const TEST_CALLEE_RE = /^test(\.(only|skip|fixme|fail|slow))?$/;

type Row = { testId: string; file: string; service: string };

type Status =
  | 'updated'
  | 'replaced'
  | 'already_ok'
  | 'skipped_no_service'
  | 'manual_file_missing'
  | 'manual_test_not_found'
  | 'manual_options_by_reference'
  | 'manual_tag_not_array'
  | 'error';

type Result = { testId: string; file: string; tag?: string; status: Status; details?: string };

const serviceTag = (service: string): string => `${TAG_PREFIX}${service.trim().toLowerCase()}`;

// Minimal RFC 4180 parser: quoted fields, escaped quotes and newlines inside quotes.
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== '');
};

const loadRows = (csvPath: string): Row[] => {
  const [header, ...body] = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const col = (name: string): number => {
    const idx = header.indexOf(name);
    if (idx < 0) throw new Error(`CSV ${csvPath} has no "${name}" column`);
    return idx;
  };
  const iId = col('test_id');
  const iFile = col('file');
  const iService = col('service');
  return body.map((r) => ({
    testId: r[iId].trim(),
    file: r[iFile].trim(),
    service: (r[iService] ?? '').trim(),
  }));
};

const titleHasId = (call: CallExpression, testId: string): boolean => {
  const first = call.getArguments()[0];
  if (!first) return false;
  const escaped = testId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`@${escaped}(?![A-Za-z0-9])`).test(first.getText());
};

const stripQuotes = (s: string): string => s.replace(/^['"`]/, '').replace(/['"`]$/, '').trim();

const applyTag = (call: CallExpression, tag: string): { status: Status; details?: string } => {
  const args = call.getArguments();
  const second = args[1];

  // No options object: `test(title, async () => {})` -> insert `{ tag: [...] }` as 2nd argument.
  if (
    !second ||
    second.getKind() === SyntaxKind.ArrowFunction ||
    second.getKind() === SyntaxKind.FunctionExpression
  ) {
    call.insertArgument(1, `{ tag: ['${tag}'] }`);
    return { status: 'updated' };
  }

  const options = second.asKind(SyntaxKind.ObjectLiteralExpression);
  if (!options) {
    return {
      status: 'manual_options_by_reference',
      details: `2nd argument is ${second.getKindName()}: ${second.getText().slice(0, 60)}`,
    };
  }

  const prop = options
    .getProperties()
    .find(
      (p) =>
        p.getKind() === SyntaxKind.PropertyAssignment &&
        ['tag', 'tags'].includes(p.asKindOrThrow(SyntaxKind.PropertyAssignment).getName())
    );

  if (!prop) {
    options.addPropertyAssignment({ name: 'tag', initializer: `['${tag}']` });
    return { status: 'updated' };
  }

  const assignment = prop.asKindOrThrow(SyntaxKind.PropertyAssignment);
  const init = assignment.getInitializer();
  if (!init) return { status: 'manual_tag_not_array', details: 'tag without initializer' };

  // tag: '@foo' -> tag: ['@foo', '@service_x']
  if (
    init.getKind() === SyntaxKind.StringLiteral ||
    init.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral
  ) {
    assignment.setInitializer(`[${init.getText()}, '${tag}']`);
    return { status: 'updated' };
  }

  const arr: ArrayLiteralExpression | undefined = init.asKind(SyntaxKind.ArrayLiteralExpression);
  if (!arr) {
    return {
      status: 'manual_tag_not_array',
      details: `tag is ${init.getKindName()}: ${init.getText().slice(0, 60)}`,
    };
  }

  const existing = arr.getElements().filter((e) => SERVICE_TAG_RE.test(stripQuotes(e.getText())));
  if (existing.length === 1 && stripQuotes(existing[0].getText()) === tag) {
    return { status: 'already_ok' };
  }
  if (existing.length > 0) {
    // The CSV wins: drop every other @service_* tag and keep a single expected one.
    const kept = arr
      .getElements()
      .map((e) => e.getText())
      .filter((t) => !SERVICE_TAG_RE.test(stripQuotes(t)));
    arr.replaceWithText(`[${[...kept, `'${tag}'`].join(', ')}]`);
    return { status: 'replaced' };
  }

  arr.addElement(`'${tag}'`);
  return { status: 'updated' };
};

const processFile = (
  project: Project,
  file: string,
  rows: Row[],
  dryRun: boolean
): { results: Result[]; changed: boolean } => {
  const abs = path.resolve(REPO_ROOT, file);
  if (!fs.existsSync(abs)) {
    return {
      results: rows.map((r) => ({
        testId: r.testId,
        file,
        status: 'manual_file_missing' as Status,
      })),
      changed: false,
    };
  }

  const source = project.addSourceFileAtPath(abs);
  const calls = source
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((c) => TEST_CALLEE_RE.test(c.getExpression().getText()));

  const results: Result[] = [];
  let changed = false;

  for (const row of rows) {
    const tag = serviceTag(row.service);
    const matching = calls.filter((c) => titleHasId(c, row.testId));
    if (matching.length === 0) {
      results.push({ testId: row.testId, file, tag, status: 'manual_test_not_found' });
      continue;
    }
    // Apply in reverse source order so earlier edits do not shift the later nodes.
    const outcomes = [...matching].reverse().map((call) => applyTag(call, tag));
    const worst =
      outcomes.find((o) => o.status.startsWith('manual')) ??
      outcomes.find((o) => o.status === 'replaced') ??
      outcomes.find((o) => o.status === 'updated') ??
      outcomes[0];
    if (outcomes.some((o) => o.status === 'updated' || o.status === 'replaced')) changed = true;
    results.push({ testId: row.testId, file, tag, status: worst.status, details: worst.details });
  }

  if (changed && !dryRun) source.saveSync();
  project.removeSourceFile(source);
  return { results, changed };
};

const parseArgs = (argv: string[]) => {
  const opts = {
    csv: path.join(REPO_ROOT, 'test_inventory.csv'),
    dryRun: false,
    check: false,
    prefixes: [] as string[],
    ids: [] as string[],
    report: undefined as string | undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (!v) throw new Error(`Missing value for ${a}`);
      return v;
    };
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--check') {
      opts.check = true;
      opts.dryRun = true;
    } else if (a === '--csv') opts.csv = path.resolve(next());
    else if (a === '--prefix') opts.prefixes = next().split(',').map((s) => s.trim().toUpperCase());
    else if (a === '--ids') opts.ids = next().split(',').map((s) => s.trim());
    else if (a === '--report') opts.report = path.resolve(next());
    else throw new Error(`Unknown option: ${a}`);
  }
  return opts;
};

const main = () => {
  const opts = parseArgs(process.argv.slice(2));
  let rows = loadRows(opts.csv);
  if (opts.prefixes.length)
    rows = rows.filter((r) => opts.prefixes.includes(r.testId.split('-')[0].toUpperCase()));
  if (opts.ids.length) rows = rows.filter((r) => opts.ids.includes(r.testId));

  const results: Result[] = [];
  const byFile = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.service) {
      results.push({ testId: r.testId, file: r.file, status: 'skipped_no_service' });
      continue;
    }
    byFile.set(r.file, [...(byFile.get(r.file) ?? []), r]);
  }

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });

  const changedFiles: string[] = [];
  for (const [file, fileRows] of byFile) {
    try {
      const out = processFile(project, file, fileRows, opts.dryRun);
      results.push(...out.results);
      if (out.changed) changedFiles.push(file);
    } catch (e) {
      for (const r of fileRows) {
        results.push({
          testId: r.testId,
          file,
          status: 'error',
          details: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;

  const mode = opts.check ? 'CHECK' : opts.dryRun ? 'DRY-RUN' : 'APPLY';
  console.log(`[${mode}] ${rows.length} rows from ${path.relative(REPO_ROOT, opts.csv)}`);
  console.log(`Files ${opts.dryRun ? 'that would change' : 'changed'}: ${changedFiles.length}`);
  for (const [status, n] of Object.entries(counts).sort()) console.log(`  ${status}: ${n}`);

  const pending = results.filter(
    (r) => r.status.startsWith('manual') || r.status === 'error' || r.status === 'skipped_no_service'
  );
  if (pending.length) {
    console.log('\nNeeds attention:');
    for (const r of pending)
      console.log(`  ${r.status}  ${r.testId}  ${r.file}${r.details ? `  (${r.details})` : ''}`);
  }

  if (opts.report) {
    fs.writeFileSync(opts.report, JSON.stringify({ counts, changedFiles, results }, null, 2));
    console.log(`\nReport written to ${opts.report}`);
  }

  if (opts.check) {
    const drift = results.filter((r) => r.status === 'updated' || r.status === 'replaced');
    const blocked = results.filter((r) => r.status.startsWith('manual') || r.status === 'error');
    if (drift.length || blocked.length) {
      console.error(`\nCheck failed: ${drift.length} missing/different tag(s), ${blocked.length} unresolved.`);
      process.exit(1);
    }
  }
};

main();
