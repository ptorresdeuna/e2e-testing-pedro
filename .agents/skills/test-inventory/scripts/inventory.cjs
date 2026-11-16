// Usage: node inventory.cjs [repoRoot] [outCsv] [reportJson]
const path = require('path'), os = require('os');
const root = path.resolve(process.argv[2] || process.cwd());
const outCsv = path.resolve(process.argv[3] || path.join(root, 'test_inventory.csv'));
const outReport = path.resolve(process.argv[4] || path.join(os.tmpdir(), 'test_inventory_report.json'));
const ts = require(require.resolve('typescript', {paths: [root]}));
const fs = require('fs'), cp = require('child_process');
const files = cp.execSync('git ls-files', {cwd: root, maxBuffer: 1e8}).toString().split('\n')
  .filter(f => /\.(ts|js|tsx)$/.test(f) && f.startsWith('playwright/tests/'));
const rows = [], noid = [], warns = [], condSkips = [];
const ID = /^@?([A-Z][A-Z0-9]*-T\d+)$/;
for (const f of files) {
  const src = fs.readFileSync(root + '/' + f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true);
  const consts = {};
  sf.forEachChild(function v(n) {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name)) consts[n.name.text] = n.initializer;
    ts.forEachChild(n, v);
  });
  const str = (n, depth = 0) => {
    if (!n || depth > 3) return null;
    if (ts.isStringLiteralLike(n)) return n.text;
    if (ts.isTemplateExpression(n)) return n.getText().slice(1, -1);
    if (ts.isIdentifier(n) && consts[n.text]) return str(consts[n.text], depth + 1);
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) { const a = str(n.left, depth), b = str(n.right, depth); return a != null && b != null ? a + b : n.getText(); }
    if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n)) return str(n.expression, depth);
    return null;
  };
  const tagsOf = (opt) => {
    if (!opt) return [];
    let o = opt; if (ts.isIdentifier(o) && consts[o.text]) o = consts[o.text];
    if (!ts.isObjectLiteralExpression(o)) { warns.push(`${f}: options no literal: ${opt.getText().slice(0,60)}`); return []; }
    const out = [];
    for (const p of o.properties) {
      if (ts.isPropertyAssignment(p) && p.name.getText() === 'tag') {
        let v = p.initializer; if (ts.isIdentifier(v) && consts[v.text]) v = consts[v.text];
        if (ts.isArrayLiteralExpression(v)) v.elements.forEach(e => { const s = str(e); if (s == null) warns.push(`${f}: tag no resuelto ${e.getText()}`); else out.push(s); });
        else { const s = str(v); if (s == null) warns.push(`${f}: tag no resuelto ${v.getText()}`); else out.push(s); }
      } else if (ts.isSpreadAssignment(p)) warns.push(`${f}: spread en opciones`);
    }
    return out;
  };
  // classify callee
  const kind = (e) => {
    const t = e.getText().replace(/\s+/g, '');
    let m;
    if (t === 'test' || t === 'it') return {k: 'test'};
    if (/^(test|it)\.(only|fixme|skip|fail|slow)$/.test(t)) return {k: 'test', mark: '@' + t.split('.')[1]};
    if (/^(test|it)\.describe(\.(only|serial|parallel|fixme|skip|configure))*$/.test(t)) { const parts = t.split('.').slice(2); return {k: 'describe', mark: parts.filter(p => ['fixme','skip','only'].includes(p)).map(p => '@' + p)}; }
    if (t === 'describe' || t === 'fit' || t === 'fdescribe') return {k: t === 'describe' ? 'describe' : 'test', mark: t.startsWith('f') ? '@only' : undefined};
    return null;
  };
  const scopeMarks = (body) => {
    const marks = [];
    const visit = (n, inHook) => {
      if (ts.isCallExpression(n)) {
        const t = n.expression.getText().replace(/\s+/g, '');
        const m = /^test\.(skip|fixme)$/.exec(t);
        if (m && !n.arguments.some(a => ts.isArrowFunction(a) && n.arguments[0] !== a && false)) {
          const a0 = n.arguments[0];
          const isDecl = a0 && str(a0) != null && n.arguments.some(a => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
          if (!isDecl) {
            if (!a0 || a0.kind === ts.SyntaxKind.TrueKeyword) marks.push('@' + m[1]);
            else condSkips.push(`${f}: ${n.getText().slice(0, 90)}`);
          }
          return;
        }
        if (/^test\.describe/.test(t)) return;
        if (/^test\.(beforeEach|beforeAll)$/.test(t)) { n.arguments.forEach(a => visit(a, true)); return; }
        if (/^test\.(only|step)$/.test(t) || t === 'test') return;
      }
      ts.forEachChild(n, x => visit(x, inHook));
    };
    visit(body, false);
    return marks;
  };
  const walk = (n, ctx) => {
    if (ts.isCallExpression(n)) {
      const c = kind(n.expression);
      if (c) {
        const args = n.arguments;
        const titleNode = args[0];
        const fnIdx = args.findIndex(a => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
        const isDecl = titleNode && (str(titleNode) != null || ts.isTemplateExpression(titleNode) || ts.isNoSubstitutionTemplateLiteral(titleNode)) && fnIdx > 0;
        const title = titleNode ? str(titleNode) : null;
        if (c.k === 'describe' && isDecl) {
          const opt = args.length > 2 ? args[1] : null;
          const marks = c.mark || [];
          const tags = [...(title.match(/@[^\s,;)]+/g) || []), ...tagsOf(opt && !ts.isArrowFunction(opt) && !ts.isFunctionExpression(opt) ? opt : null), ...marks];
          const sm = args[fnIdx] ? scopeMarks(args[fnIdx]) : [];
          args[fnIdx] && walk(args[fnIdx], {tags: [...ctx.tags, ...tags, ...sm]});
          return;
        }
        if (c.k === 'test' && isDecl) {
          const opt = fnIdx > 1 ? args[1] : null;
          const marks = c.mark && !['@slow','@only'].includes(c.mark) ? [c.mark] : (c.mark === '@only' ? ['@only'] : []);
          const inTitle = title.match(/@[^\s,;)]+/g) || [];
          const ids = inTitle.filter(t => ID.test(t));
          const own = [...inTitle.filter(t => !ID.test(t)), ...tagsOf(opt), ...marks];
          const clean = title.replace(/@[^\s,;)]+/g, '').replace(/\s+/g, ' ').replace(/^[\s\-–:|]+|[\s\-–:|]+$/g, '').trim();
          const all = [...new Set([...ctx.tags, ...own])];
          if (ids.length === 0) noid.push({file: f, title});
          else {
            if (ids.length > 1 || new Set(ids).size < ids.length) warns.push(`MULTI-ID ${f}: ${ids.join(' ')}`);
            rows.push({id: ids[0].slice(1), title: clean, file: f, tags: all.join(' ')});
          }
          args[fnIdx] && ts.forEachChild(args[fnIdx], x => walk(x, ctx));
          return;
        }
      }
    }
    ts.forEachChild(n, x => walk(x, ctx));
  };
  walk(sf, {tags: scopeMarks(sf)});
}
const q = s => /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
const out = ['test_id,title,file,service,spec_tags,services_called', ...rows.map(r => [r.id, q(r.title), r.file, '', q(r.tags), ''].join(','))];
fs.writeFileSync(outCsv, out.join('\n') + '\n');
const cnt = {}; rows.forEach(r => (cnt[r.id] = cnt[r.id] || []).push(r.file));
const dups = Object.entries(cnt).filter(([, v]) => v.length > 1);
fs.writeFileSync(outReport, JSON.stringify({files: files.length, rows: rows.length, condSkips, noid, warns, dups}, null, 1));
console.log('csv:', outCsv, 'report:', outReport);
console.log({files: files.length, rows: rows.length, condSkips, noid: noid.length, warns: warns.length, dups: dups.length});
