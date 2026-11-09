/**
 * A control box sized by a px literal that exactly matches a control rank.
 *
 * The ranks carry control height across density; a literal that happens to
 * equal one is a control that will not move when the density changes.
 *
 * Deliberately narrow. Only `height` / `min-height` / `block-size`, because a
 * width that equals a rank is usually a square icon well, and only exact rank
 * values, because an off-ladder number is a design decision about which rung it
 * belongs on rather than a mechanical substitution.
 *
 * A box that is rank-sized but is artwork — a fixed-aspect preview, a glyph —
 * carries `not-a-control` in a comment on the declaration or the line above.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { blocks, lineAt, stripComments, varSpans, walk } from './lib/cssBlocks.ts';
import { isStylesheet } from './check-spacing.ts';

/** The control ranks and their value in the default density, from the generated tokens. */
export function ranks(css: string): Map<number, string> {
  const root = /^:root \{\n(.*?)^\}/ms.exec(css)?.[1] ?? '';
  const names = ['control-h-xs', 'control-h-sm', 'control-h', 'tb-height'];
  const out = new Map<number, string>();
  for (const name of names) {
    const m = new RegExp(`--wzl-${name}:\\s*(\\d+)px;`).exec(root);
    // First name wins a shared value, so the narrowest rank is the suggestion.
    if (m && !out.has(Number(m[1]))) out.set(Number(m[1]), name);
  }
  return out;
}

const DECL = /^(?:height|min-height|block-size)\s*:/;
const LEN = /(?<![-\d.])(\d+)px/g;

export interface Offender {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  readonly token: string;
}

/** An exemption marker on the declaration or the line above it. */
const EXEMPT = /not-a-control/;

export function offenders(files: readonly { path: string; source: string }[], rankOf: Map<number, string>): Offender[] {
  const out: Offender[] = [];
  for (const { path, source } of files) {
    const lines = source.split('\n');
    const clean = stripComments(source);
    for (const { decls } of blocks(clean)) {
      for (const { text, index } of decls) {
        if (!DECL.test(text)) continue;
        // A box that happens to be rank-sized but is artwork: a fixed-aspect preview, a glyph.
        const at = lineAt(clean, index);
        if (EXEMPT.test(lines[at - 1]) || (at > 1 && EXEMPT.test(lines[at - 2]))) continue;
        const spans = varSpans(text);
        for (const m of text.matchAll(LEN)) {
          const token = rankOf.get(Number(m[1]));
          if (!token) continue;
          if (spans.some(([a, b]) => a < m.index && m.index < b)) continue;
          out.push({ file: path, line: lineAt(clean, index + m.index), text: text.replace(/\s+/g, ' '), token });
        }
      }
    }
  }
  return out;
}


if (process.argv[1]?.endsWith('check-controls.ts')) {
  const root = join(import.meta.dirname, '..');
  const rankOf = ranks(readFileSync(join(root, 'packages/theme/src/generated/tokens.css'), 'utf8'));
  if (rankOf.size === 0) throw new Error('no control ranks in the generated tokens; has the theme been built?');
  const files = [...walk(join(root, 'packages')), ...walk(join(root, 'apps'))].filter(isStylesheet).map((path) => ({
    path: relative(root, path),
    source: readFileSync(path, 'utf8'),
  }));
  const bad = offenders(files, rankOf);
  for (const o of bad) console.error(`${o.file}:${o.line}  use var(--wzl-${o.token})  ${o.text}`);
  console.log(`${files.length} stylesheets, ${bad.length} frozen control height(s)`);
  process.exit(bad.length === 0 ? 0 : 1);
}
