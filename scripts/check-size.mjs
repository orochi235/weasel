#!/usr/bin/env node
/**
 * A source file past a few hundred lines is several things sharing one file,
 * and a function past a hundred is several steps sharing one body. This fails
 * the build on a new one.
 *
 * Files already over a cap are recorded in `check-size.allow.json` at the size
 * they had when recorded. An entry is a ceiling that only comes down: the file
 * fails when it grows past it, and the entry fails when the file shrinks below
 * it, until `npm run check:size -- --update` lowers it.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

export const CAPS = { lines: 400, fn: 120 };

const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-examples', 'examples', 'generated']);
const isSource = (name) =>
  /\.(ts|tsx)$/.test(name) &&
  !/\.(test|spec|stories)\.(ts|tsx)$/.test(name) &&
  !name.endsWith('.d.ts') &&
  !name.endsWith('.gen.ts');

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (isSource(entry)) yield full;
  }
}

/** A file's line count and the line span of its longest function with a body. */
export function measure(source, fileName = 'file.ts') {
  const kind = fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line;
  let longestFunction = 0;
  const visit = (node) => {
    if (ts.isFunctionLike(node) && 'body' in node && node.body) {
      longestFunction = Math.max(longestFunction, lineOf(node.getEnd()) - lineOf(node.getStart(sf)) + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const lines = source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
  return { lines, longestFunction };
}

/** What an entry for `size` records: only the measures over their cap. */
function entryFor(size, caps) {
  const entry = {};
  if (size.lines > caps.lines) entry.lines = size.lines;
  if (size.longestFunction > caps.fn) entry.longestFunction = size.longestFunction;
  return entry;
}

export function verdict(size, allowed, caps) {
  const maxLines = Math.max(caps.lines, allowed?.lines ?? 0);
  const maxFn = Math.max(caps.fn, allowed?.longestFunction ?? 0);
  if (size.lines > maxLines || size.longestFunction > maxFn) return 'over';
  if (!allowed) return 'ok';
  const now = entryFor(size, caps);
  return now.lines === allowed.lines && now.longestFunction === allowed.longestFunction ? 'ok' : 'stale';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const ALLOW = join(ROOT, 'scripts', 'check-size.allow.json');
  const update = process.argv.includes('--update');
  const seeding = update && !existsSync(ALLOW);
  const allow = existsSync(ALLOW) ? JSON.parse(readFileSync(ALLOW, 'utf8')) : {};

  const next = {};
  const over = [];
  const stale = [];
  for (const pkg of readdirSync(join(ROOT, 'packages')).sort()) {
    const src = join(ROOT, 'packages', pkg, 'src');
    if (!existsSync(src) || !statSync(src).isDirectory()) continue;
    for (const file of walk(src)) {
      const rel = relative(ROOT, file);
      const size = measure(readFileSync(file, 'utf8'), file);
      const result = seeding ? 'stale' : verdict(size, allow[rel], CAPS);
      const entry = entryFor(size, CAPS);
      const keep = Object.keys(entry).length > 0;
      if (result === 'over') {
        over.push(`  ${rel}  ${String(size.lines).padStart(5)} lines, longest function ${String(size.longestFunction).padStart(4)}`);
        if (allow[rel]) next[rel] = allow[rel];
      } else if (keep) {
        next[rel] = entry;
        if (result === 'stale') stale.push(`  ${rel}`);
      } else if (result === 'stale') {
        stale.push(`  ${rel}`);
      }
    }
  }

  if (update) {
    const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]));
    writeFileSync(ALLOW, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`check:size — allowlist written, ${Object.keys(sorted).length} entries.`);
  }
  if (over.length > 0) {
    console.error(
      `check:size — over ${CAPS.lines} lines or a function over ${CAPS.fn}, past what the allowlist records:\n` +
        over.join('\n') +
        '\n\nSplit the file along what owns what. --update never raises an entry.',
    );
    process.exit(1);
  }
  if (stale.length > 0 && !update) {
    console.error(
      'check:size — these shrank below their allowlist entry:\n' + stale.join('\n') +
        '\n\nRun `npm run check:size -- --update` to keep the gain.',
    );
    process.exit(1);
  }
  if (!update) console.log('sizes: no file or function grew past its cap.');
}
