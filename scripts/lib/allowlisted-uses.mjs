/**
 * What `check:frame-loops` and `check:listener-sets` share: find each line of source that names a
 * pattern outside a comment, and hold every file to the uses its allowlist entry covers, no more and
 * no fewer.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { lineAt, stripComments } from './cssBlocks.ts';

/** The 1-based line of each match of the global regex `pattern` in `source` outside a comment, one per match. */
export function matchLines(source, pattern) {
  const clean = stripComments(source);
  return [...clean.matchAll(pattern)].map((match) => lineAt(clean, match.index));
}

/** Every file under `dir` that `keep(name)` accepts, skipping directories named in `skip`. */
export function* sourceFiles(dir, { skip, keep }) {
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* sourceFiles(full, { skip, keep });
    else if (keep(entry)) yield full;
  }
}

/** The uses an allowlist entry covers: none unlisted, one for a reason alone, `n` for `[why, n]`. */
const usesOf = (entry) => (entry === undefined ? 0 : Array.isArray(entry) ? entry[1] : 1);

/** `lines` when a file has more uses than its allowlist entry covers, else none. */
export function offendingLines(lines, allowedUses = 0) {
  return lines.length > allowedUses ? lines : [];
}

/**
 * `found` (each file's matching lines, by repo path) against `allowed` (each listed path's entry):
 * `offenders`, each use in a file past its allowance as `path:line`, and `stale`, each entry covering
 * more uses than its file has, a missing file having none. A stale entry lets a new use back in unseen.
 */
export function judgeUses(found, allowed) {
  const offenders = [];
  for (const [path, lines] of found) {
    for (const line of offendingLines(lines, usesOf(allowed.get(path)))) offenders.push(`${path}:${line}`);
  }
  const stale = [];
  for (const [path, entry] of allowed) {
    const has = found.get(path)?.length ?? 0;
    if (has < usesOf(entry)) stale.push(`${path} is allowed ${usesOf(entry)} and has ${has}`);
  }
  return { offenders, stale };
}
