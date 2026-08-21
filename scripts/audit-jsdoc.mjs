#!/usr/bin/env node
// Enumerates every symbol reachable through a workspace package's public
// entry points and reports which ones lack a JSDoc block at their definition
// site. Run `node scripts/audit-jsdoc.mjs --help` for options.
import { Project, Node } from 'ts-morph';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = join(ROOT, 'packages');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node scripts/audit-jsdoc.mjs [options]

Enumerates the public exports of every package under packages/ (resolved
through each package.json "exports" map, mapped back from dist/ to src/) and
reports which have no JSDoc block at their definition site.

Options:
  --pkg <name>    Restrict to one package, by directory name (e.g. geom).
  --json          Emit the full record set as JSON instead of a summary.
  --undocumented  List every undocumented symbol with its definition site.
  --quiet         Summary table only.
  --exclude <a,b> Drop these packages from the report (by directory name).
`);
  process.exit(0);
}
const only = args.includes('--pkg') ? args[args.indexOf('--pkg') + 1] : null;
const asJson = args.includes('--json');
const listUndocumented = args.includes('--undocumented');
const quiet = args.includes('--quiet');
// Packages to leave out of the report entirely (still scanned, so a symbol
// defined elsewhere but re-exported through them is not lost).
const exclude = args.includes('--exclude') ? args[args.indexOf('--exclude') + 1].split(',') : [];

/**
 * Public entry source files for a package. The tsup `entry` map is
 * authoritative when present, since it is what actually produces the published
 * bundles; otherwise the `exports` map is walked and each dist path mapped back
 * to its source.
 */
function entryPoints(pkgDir) {
  const files = new Set();

  const tsupPath = join(pkgDir, 'tsup.config.ts');
  if (existsSync(tsupPath)) {
    const src = readFileSync(tsupPath, 'utf8');
    const block = /entry:\s*\{([\s\S]*?)\}/.exec(src);
    if (block) {
      for (const m of block[1].matchAll(/:\s*'([^']+)'/g)) {
        const abs = resolve(pkgDir, m[1]);
        if (existsSync(abs)) files.add(abs);
      }
    }
  }
  if (files.size > 0) return [...files].sort();

  const pkgJsonPath = join(pkgDir, 'package.json');
  if (!existsSync(pkgJsonPath)) return [];
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  const specifiers = new Set();
  const collect = (value) => {
    if (typeof value === 'string') specifiers.add(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(pkg.exports ?? pkg.main ?? pkg.module ?? {});

  for (const spec of specifiers) {
    if (!spec.includes('/dist/')) continue;
    const stem = spec.replace('/dist/', '/src/').replace(/\.(d\.ts|js|mjs|cjs)$/, '');
    for (const candidate of [`${stem}.ts`, `${stem}.tsx`, `${stem}/index.ts`, `${stem}/index.tsx`]) {
      const abs = resolve(pkgDir, candidate);
      if (existsSync(abs)) { files.add(abs); break; }
    }
  }
  return [...files].sort();
}

/** The node whose leading comment counts as this declaration's JSDoc. */
function jsdocHost(node) {
  if (Node.isVariableDeclaration(node)) {
    const stmt = node.getFirstAncestor(Node.isVariableStatement);
    if (stmt) return stmt;
  }
  return node;
}

function docTextOf(node) {
  const host = jsdocHost(node);
  if (typeof host.getJsDocs !== 'function') return '';
  return host.getJsDocs().map((d) => d.getInnerText().trim()).join('\n').trim();
}

const project = new Project({
  tsConfigFilePath: join(ROOT, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: false,
});

const packageDirs = readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => (only ? name === only : true))
  .sort();

const records = [];
const perPackage = [];

for (const name of packageDirs) {
  const pkgDir = join(ROOT, 'packages', name);
  const entries = entryPoints(pkgDir);
  if (entries.length === 0) { perPackage.push({ pkg: name, entries: 0, total: 0, undocumented: 0, note: 'no resolvable src entry points' }); continue; }

  const seen = new Set();
  let total = 0;
  let undocumented = 0;

  for (const entry of entries) {
    const sf = project.addSourceFileAtPathIfExists(entry) ?? project.getSourceFile(entry);
    if (!sf) continue;
    for (const [symbol, decls] of sf.getExportedDeclarations()) {
      for (const decl of decls) {
        const file = decl.getSourceFile().getFilePath();
        // Only workspace source counts. This drops node_modules, and also drops
        // consumer-side interface augmentations (apps/draw merges into core's
        // `DepSchema`), which are reachable through the barrel but are not
        // definition sites of anything the package publishes.
        if (!file.startsWith(PACKAGES) || file.includes('/node_modules/')) continue;
        // Expando assignments (`Toolbar.Group = …`, `usePenTool.prefs = …`) resolve
        // to a bare identifier, not to a declaration site of the export itself.
        if (Node.isIdentifier(decl)) continue;
        const line = decl.getStartLineNumber();
        const key = `${symbol}@${file}:${line}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const doc = docTextOf(decl);
        const record = {
          pkg: name,
          symbol,
          kind: decl.getKindName(),
          entry: relative(ROOT, entry),
          file: relative(ROOT, file),
          line,
          definedIn: relative(ROOT, file).split('/')[1] ?? '?',
          documented: doc.length > 0,
          internal: /@internal\b/.test(doc),
          experimental: /@experimental\b/.test(doc),
        };
        records.push(record);
        total += 1;
        if (!record.documented) undocumented += 1;
      }
    }
  }
  perPackage.push({ pkg: name, entries: entries.length, total, undocumented });
}

// One symbol can be reachable from several barrels (`weasel-js` re-exports all
// of `@weasel-js/core`, for one). The work list is the set of definition sites.
const bySite = new Map();
for (const r of records) {
  const key = `${r.symbol}@${r.file}:${r.line}`;
  const existing = bySite.get(key);
  if (existing) {
    existing.barrels.push(r.pkg);
    if (!existing.entries.includes(r.entry)) existing.entries.push(r.entry);
  } else bySite.set(key, { ...r, barrels: [r.pkg], entries: [r.entry] });
}
let sites = [...bySite.values()];
for (const ex of exclude) sites = sites.filter((s) => !s.barrels.every((b) => b === ex) && s.definedIn !== ex);

if (asJson) {
  console.log(JSON.stringify(sites, null, 2));
  process.exit(0);
}

if (listUndocumented) {
  for (const r of sites.filter((r) => !r.documented)) {
    console.log(`${r.definedIn}\t${r.symbol}\t${r.kind}\t${r.file}:${r.line}`);
  }
  console.log('');
}

const pad = (s, n) => String(s).padEnd(n);
const byPkg = new Map();
for (const r of sites) {
  const e = byPkg.get(r.definedIn) ?? { total: 0, undocumented: 0, internal: 0, experimental: 0 };
  e.total += 1;
  if (!r.documented) e.undocumented += 1;
  if (r.internal) e.internal += 1;
  if (r.experimental) e.experimental += 1;
  byPkg.set(r.definedIn, e);
}
console.log(`${pad('defined in', 14)}${pad('exports', 9)}${pad('undocumented', 14)}${pad('@internal', 11)}@experimental`);
for (const [name, e] of [...byPkg].sort()) {
  console.log(`${pad(name, 14)}${pad(e.total, 9)}${pad(e.undocumented, 14)}${pad(e.internal, 11)}${e.experimental}`);
}
const undoc = sites.filter((r) => !r.documented).length;
console.log(`\n${sites.length} public exports (unique definition sites), ${undoc} undocumented (${sites.length ? Math.round((undoc / sites.length) * 100) : 0}%)`);

if (!quiet) {
  console.log('\nEntry points scanned:');
  for (const p of perPackage) console.log(`  ${pad(p.pkg, 12)} ${p.entries} entry point(s)${p.note ? ` — ${p.note}` : ''}`);
  // A `test-seams` entry is where a package parks reset hooks that another
  // workspace's tests need. Reaching one is a deliberate import of a test
  // surface, so an @internal symbol there is placed, not leaked.
  const isSeamEntry = (e) => /(^|\/)test-seams\.ts$/.test(e);
  const internal = sites.filter((r) => r.internal);
  const leaked = internal.filter((r) => !r.entries.every(isSeamEntry));
  const parked = internal.length - leaked.length;
  if (leaked.length) {
    console.log(`\n${leaked.length} export(s) whose own JSDoc marks them @internal:`);
    for (const r of leaked) console.log(`  ${r.symbol}\t${r.file}:${r.line}\tvia ${r.barrels.join(', ')}`);
  }
  if (parked) console.log(`\n${parked} @internal export(s) reachable only through a test-seams entry.`);
}
