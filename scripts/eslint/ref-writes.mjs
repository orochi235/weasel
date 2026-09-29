// Lists every render-time ref write `weasel/no-render-ref-write` reports, then
// a count per package. Usage: npm run lint:ref-writes [-- <dir>...]
import { ESLint } from 'eslint';
import { relative } from 'node:path';

const dirs = process.argv.slice(2);
const eslint = new ESLint();
const results = await eslint.lintFiles(dirs.length ? dirs : ['packages', 'apps']);
const perPackage = new Map();
for (const r of results) {
  const file = relative(process.cwd(), r.filePath);
  for (const m of r.messages) {
    if (m.ruleId !== 'weasel/no-render-ref-write') continue;
    console.log(`${file}:${m.line}:${m.column}`);
    const pkg = file.split('/').slice(0, 2).join('/');
    perPackage.set(pkg, (perPackage.get(pkg) ?? 0) + 1);
  }
}
console.log();
const rows = [...perPackage].sort((a, b) => b[1] - a[1]);
for (const [pkg, n] of rows) console.log(`${String(n).padStart(4)}  ${pkg}`);
console.log(`${String(rows.reduce((t, [, n]) => t + n, 0)).padStart(4)}  total`);
