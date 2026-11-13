/**
 * A `gap`, `padding` or `margin` written as a px literal that the space ladder
 * already has a rung for. The ladder is what carries spacing across density, so
 * a literal here is a hole: it stays put while everything around it moves.
 *
 * A `var()` fallback is the default of the property it belongs to —
 * `var(--slider-thumb-size, 8px)` is a thumb, not a gap — so it is left alone.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { blocks, lineAt, stripComments, varSpans, walk } from './lib/cssBlocks.ts';

/** px → rung. The ladder's own values, read from the generated tokens. */
export function ladder(css: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const m of css.matchAll(/--wzl-space-(\d+):\s*(\d+)px;/g)) out.set(Number(m[2]), m[1]);
  return out;
}

const PROPS =
  'gap|row-gap|column-gap|padding|margin' +
  '|(?:padding|margin)-(?:top|right|bottom|left|block|inline)' +
  '|(?:padding|margin)-(?:block|inline)-(?:start|end)';
const DECL = new RegExp(`^(?:${PROPS})\\s*:`);
/** Not preceded by a minus, digit or dot: skips -4px and 1.5px. */
const LEN = /(?<![-\d.])(\d+)px/g;

export interface Offender {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  readonly rung: string;
}

export function offenders(files: readonly { path: string; source: string }[], rungs: Map<number, string>): Offender[] {
  const out: Offender[] = [];
  for (const { path, source } of files) {
    const clean = stripComments(source);
    for (const { decls } of blocks(clean)) {
      for (const { text, index } of decls) {
        if (!DECL.test(text)) continue;
        const spans = varSpans(text);
        for (const m of text.matchAll(LEN)) {
          const rung = rungs.get(Number(m[1]));
          if (!rung) continue;
          if (spans.some(([a, b]) => a < m.index && m.index < b)) continue;
          out.push({ file: path, line: lineAt(clean, index + m.index), text: text.replace(/\s+/g, ' '), rung });
        }
      }
    }
  }
  return out;
}

/** Foundations is the token showcase: its literals are the subject, not a lapse. */
export const isStylesheet = (p: string) =>
  /\.(css|less)$/.test(p) && !p.includes('.stories.') && !p.includes('/Foundations/');

if (process.argv[1]?.endsWith('check-spacing.ts')) {
  const root = join(import.meta.dirname, '..');
  const rungs = ladder(readFileSync(join(root, 'packages/theme/src/generated/tokens.css'), 'utf8'));
  if (rungs.size === 0) throw new Error('no --wzl-space-<n> rungs in packages/theme/src/generated/tokens.css; run `npm run gen:tokens -w @weasel-js/theme`');
  const files = [...walk(join(root, 'packages')), ...walk(join(root, 'apps'))].filter(isStylesheet).map((path) => ({
    path: relative(root, path),
    source: readFileSync(path, 'utf8'),
  }));
  const bad = offenders(files, rungs);
  for (const o of bad) console.error(`${o.file}:${o.line}  use var(--wzl-space-${o.rung})  ${o.text}`);
  console.log(`${files.length} stylesheets, ${bad.length} spacing literal(s) with a rung`);
  process.exit(bad.length === 0 ? 0 : 1);
}
