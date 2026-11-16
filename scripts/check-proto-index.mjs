#!/usr/bin/env node
/**
 * Fails on a `record[key]` that can reach `Object.prototype` (`protoIndexAccess`, in `lib/proto-index.mjs`) in
 * shipped source. It needs type information over every file, which does not fit in lint's heap, so it runs here
 * over one TypeScript program instead.
 *
 * Files in `check-proto-index.pending.json` held a site when the check landed and are not failed for one. The
 * list only comes down: an entry whose file is now clean or gone fails until
 * `npm run check:proto-index -- --update` drops it, and `--update` never adds one.
 *
 * `--scan [<path filter>]` lists every site, pending or not.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { PROTO_INDEX_MESSAGES, protoIndexAccess } from './lib/proto-index.mjs';

/** Shipped source: each package's and app's `src`, less tests, benches, stories and fixtures. */
export const inScope = (rel) =>
  /^(packages|apps)\/[^/]+\/src\/.*\.tsx?$/.test(rel)
  && !/\.(test|spec|bench|stories|fixture|fixtures)\.tsx?$|\/__tests__\/|\/testing\/|\.d\.ts$/.test(rel);

/** Every access in `sourceFile` that can reach `Object.prototype`, as `{ line, access, text }`. */
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

/**
 * What the check fails on: a site in a file the pending list does not name, and a pending entry whose file is
 * clean or gone. `keep` is the pending list as `--update` writes it.
 */
export function verdict(pending, exists, sitesOf) {
  const listed = new Set(pending);
  const unlisted = [];
  for (const [rel, sites] of sitesOf) if (!listed.has(rel) && sites.length > 0) unlisted.push([rel, sites]);
  const keep = [];
  const clean = [];
  const gone = [];
  for (const rel of pending) {
    if (!exists(rel)) gone.push(rel);
    else if ((sitesOf.get(rel)?.length ?? 0) > 0) keep.push(rel);
    else clean.push(rel);
  }
  return { unlisted, keep, clean, gone };
}

function* shipped(root, dir) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('dist')) continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) yield* shipped(root, rel);
    else if (inScope(rel)) yield rel;
  }
}

/** Each shipped file's sites, from one program under the root tsconfig's options. */
export function scan(root, filter = '') {
  const rels = ['packages', 'apps'].flatMap((dir) => [...shipped(root, dir)]).filter((rel) => rel.includes(filter));
  const cfg = ts.getParsedCommandLineOfConfigFile(join(root, 'tsconfig.json'), {}, {
    ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {},
  });
  const options = { ...cfg.options, noEmit: true, incremental: false, declaration: false, declarationMap: false, sourceMap: false };
  const program = ts.createProgram({ rootNames: rels.map((rel) => join(root, rel)), options });
  const checker = program.getTypeChecker();
  const out = new Map();
  for (const rel of rels) out.set(rel, sitesIn(checker, program.getSourceFile(join(root, rel))));
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const LIST = join(ROOT, 'scripts', 'check-proto-index.pending.json');
  const args = process.argv.slice(2);

  if (args[0] === '--scan') {
    const sites = scan(ROOT, args[1]);
    let total = 0;
    for (const [rel, found] of [...sites].sort(([a], [b]) => a.localeCompare(b))) {
      for (const s of found) console.log(`${rel}:${s.line} ${s.access} ${s.text}`);
      total += found.length;
    }
    console.error(`check:proto-index — ${total} site(s) in ${sites.size} file(s).`);
    process.exit(0);
  }

  const update = args.includes('--update');
  const pending = JSON.parse(readFileSync(LIST, 'utf8'));
  const { unlisted, keep, clean, gone } = verdict(pending, (rel) => existsSync(join(ROOT, rel)), scan(ROOT));
  let failed = false;

  if (unlisted.length > 0) {
    failed = true;
    const lines = unlisted.flatMap(([rel, sites]) => sites.map((s) => `  ${rel}:${s.line}  ${s.text}\n    ${PROTO_INDEX_MESSAGES[s.access]}`));
    console.error(`check:proto-index — a key can reach Object.prototype:\n${lines.join('\n')}\n`);
  }
  if (update) {
    writeFileSync(LIST, `${JSON.stringify(keep, null, 2)}\n`);
    console.log(`check:proto-index — pending list written, ${keep.length} entries (${clean.length + gone.length} dropped).`);
  } else if (clean.length + gone.length > 0) {
    failed = true;
    console.error(
      'check:proto-index — these pending entries no longer hold a site:\n' +
        [...clean.map((rel) => `  ${rel}`), ...gone.map((rel) => `  ${rel} (gone)`)].join('\n') +
        '\n\nRemove them from the pending list: run `npm run check:proto-index -- --update`.',
    );
  }
  if (failed) process.exit(1);
  if (!update) console.log(`check:proto-index — no new site; ${keep.length} pending files still hold one.`);
}
