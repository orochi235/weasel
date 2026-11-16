#!/usr/bin/env node
/**
 * `weasel/no-proto-index` skips the files in `eslint/no-proto-index.pending.json`, which held a flagged access
 * when the rule landed. The list only comes down: this fails on an entry whose file is now clean or gone, until
 * `npm run check:proto-pending -- --update` drops it, and `--update` never adds one.
 *
 * `--scan [<path filter>]` lists every site the rule flags in shipped source instead, pending or not.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { protoIndexAccess } from './eslint/no-proto-index.mjs';

/** What the rule's config block lints: shipped source, less tests, benches, stories and fixtures. */
export const inScope = (rel) =>
  /^(packages|apps)\/[^/]+\/src\/.*\.tsx?$/.test(rel)
  && !/\.(test|spec|bench|stories|fixture|fixtures)\.tsx?$|\/__tests__\/|\/testing\/|\.d\.ts$/.test(rel);

/** Every access in `sourceFile` the rule reports, as `{ line, access, text }`. */
export function sitesIn(checker, sourceFile) {
  const sites = [];
  const visit = (node) => {
    if (ts.isElementAccessExpression(node)) {
      const access = protoIndexAccess(checker, node);
      if (access) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        sites.push({ line, access, text: node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 100) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return sites;
}

/** The pending list split by what each entry's file holds now: still flagged, clean, or gone. */
export function classify(pending, exists, siteCount) {
  const keep = [];
  const clean = [];
  const gone = [];
  for (const rel of pending) {
    if (!exists(rel)) gone.push(rel);
    else if (siteCount(rel) > 0) keep.push(rel);
    else clean.push(rel);
  }
  return { keep, clean, gone };
}

const parsed = (configPath) =>
  ts.getParsedCommandLineOfConfigFile(configPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });

/**
 * Each file's sites, from one program per tsconfig: the root's for every file it includes, then each package's
 * for the rest. A file no config includes maps to null, which the check keeps rather than calling clean.
 */
export function scan(root, rels) {
  const configs = [join(root, 'tsconfig.json')];
  for (const dir of ['packages', 'apps']) {
    for (const name of readdirSync(join(root, dir)).sort()) {
      const p = join(root, dir, name, 'tsconfig.json');
      if (existsSync(p)) configs.push(p);
    }
  }
  const left = new Set(rels.map((rel) => resolve(root, rel)));
  const out = new Map();
  for (const configPath of configs) {
    if (left.size === 0) break;
    const cfg = parsed(configPath);
    const files = cfg.fileNames.map((f) => resolve(f)).filter((f) => left.has(f));
    if (files.length === 0) continue;
    const program = ts.createProgram({ rootNames: files, options: { ...cfg.options, noEmit: true, incremental: false } });
    const checker = program.getTypeChecker();
    for (const file of files) {
      left.delete(file);
      out.set(relative(root, file), sitesIn(checker, program.getSourceFile(file)));
    }
  }
  for (const file of left) out.set(relative(root, file), null);
  return out;
}

function* shipped(root, dir = '') {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) yield* shipped(root, rel);
    else if (inScope(rel)) yield rel;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const LIST = join(dirname(fileURLToPath(import.meta.url)), 'eslint', 'no-proto-index.pending.json');
  const args = process.argv.slice(2);

  if (args[0] === '--scan') {
    const filter = args[1] ?? '';
    const rels = ['packages', 'apps'].flatMap((d) => [...shipped(ROOT, d)]).filter((rel) => rel.includes(filter));
    let total = 0;
    for (const [rel, sites] of [...scan(ROOT, rels)].sort(([a], [b]) => a.localeCompare(b))) {
      for (const s of sites ?? []) console.log(`${rel}:${s.line} ${s.access} ${s.text}`);
      total += sites?.length ?? 0;
    }
    console.error(`check:proto-pending — ${total} site(s) in ${rels.length} file(s).`);
    process.exit(0);
  }

  const update = args.includes('--update');
  const pending = JSON.parse(readFileSync(LIST, 'utf8'));
  const present = pending.filter((rel) => existsSync(join(ROOT, rel)));
  const sites = scan(ROOT, present);
  const { keep, clean, gone } = classify(pending, (rel) => existsSync(join(ROOT, rel)), (rel) => sites.get(rel)?.length ?? 1);

  if (update) {
    writeFileSync(LIST, `${JSON.stringify(keep, null, 2)}\n`);
    console.log(`check:proto-pending — pending list written, ${keep.length} entries (${clean.length + gone.length} dropped).`);
  } else if (clean.length + gone.length > 0) {
    console.error(
      'check:proto-pending — these pending entries no longer hold a weasel/no-proto-index site:\n' +
        [...clean.map((rel) => `  ${rel}`), ...gone.map((rel) => `  ${rel} (gone)`)].join('\n') +
        '\n\nRemove them from the pending list: run `npm run check:proto-pending -- --update`.',
    );
    process.exit(1);
  } else {
    console.log(`check:proto-pending — all ${keep.length} pending files still hold a site.`);
  }
}
