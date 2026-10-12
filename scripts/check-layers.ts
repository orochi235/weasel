/**
 * A `z-index` written as a number that belongs on the theme's layer ladder.
 *
 * The `--wzl-z-*` rungs are what order a toolbar, a dialog, a toast, a popover
 * and a drag ghost against each other, and against whatever a consumer retunes.
 * A literal at or above the lowest rung is a layer outside that order. Smaller
 * numbers order siblings inside one stacking context and are left alone, and so
 * is a `var()` fallback, which is the rung's own default.
 *
 * Runs under tsx so it shares `lib/cssBlocks.ts` with the other token checks.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { lineAt, stripComments, walk } from './lib/cssBlocks.ts';

/** The lowest rung of the ladder, read from the generated tokens. */
export function floor(css: string): number {
  const rungs = [...css.matchAll(/--wzl-z-[\w-]+:\s*(\d+);/g)].map((m) => Number(m[1]));
  return Math.min(...rungs);
}

const LITERAL = /(?:z-index\s*:|zIndex\s*[:=])\s*['"`]?(\d+)/g;

export interface Offender {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

export function offenders(files: readonly { path: string; source: string }[], lowest: number): Offender[] {
  const out: Offender[] = [];
  for (const { path, source } of files) {
    const bare = stripComments(source);
    for (const m of bare.matchAll(LITERAL)) {
      if (Number(m[1]) < lowest) continue;
      const line = lineAt(bare, m.index);
      out.push({ file: path, line, text: source.split('\n')[line - 1].trim() });
    }
  }
  return out;
}

if (process.argv[1]?.endsWith('check-layers.ts')) {
  const root = join(import.meta.dirname, '..');
  const lowest = floor(readFileSync(join(root, 'packages/theme/src/generated/tokens.css'), 'utf8'));
  if (!Number.isFinite(lowest)) throw new Error('no --wzl-z-<layer> rungs in the generated tokens; has the theme been built?');
  const files = [...walk(join(root, 'packages')), ...walk(join(root, 'apps'))]
    .filter((p) => !p.includes('.stories.'))
    .map((path) => ({ path: relative(root, path), source: readFileSync(path, 'utf8') }));
  const bad = offenders(files, lowest);
  for (const o of bad) console.error(`${o.file}:${o.line}  use a --wzl-z-* rung  ${o.text}`);
  console.log(`${files.length} files, ${bad.length} z-index literal(s) off the ladder`);
  process.exit(bad.length === 0 ? 0 : 1);
}
