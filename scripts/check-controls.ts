/**
 * A control box sized by a px literal that exactly matches a control rank.
 *
 * The ranks carry control height across density; a literal that happens to
 * equal one is a control that will not move when the density changes, which is
 * how `Button` sat at 24px in every density while its label grew. Matching the
 * rank's comfortable value is the tell: 24px where `--wzl-control-h` is 24px is
 * a frozen control, not a coincidence.
 *
 * Deliberately narrow. Only `height` / `min-height` / `block-size`, because a
 * width that equals a rank is usually a square icon well, and only exact rank
 * values, because an off-ladder number is a design decision about which rung it
 * belongs on rather than a mechanical substitution.
 *
 * A box that is rank-sized but is artwork — a fixed-aspect preview, a glyph —
 * carries `not-a-control` in a comment on the declaration or the line above.
 *
 * Runs under tsx so theme modules resolve through the root tsconfig's paths to
 * source, with no build first.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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

const DECL = /(?:^|[{;])\s*(height|min-height|block-size)\s*:\s*([^;}]*)[;}]/;
const LEN = /(?<![-\d.])(\d+)px/g;

export interface Offender {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  readonly token: string;
}

/** Index ranges covered by a `var()` fallback, which belongs to that property, not this one. */
function varSpans(value: string): [number, number][] {
  const spans: [number, number][] = [];
  for (const m of value.matchAll(/var\(/g)) {
    let depth = 0;
    for (let i = m.index + 3; i < value.length; i += 1) {
      if (value[i] === '(') depth += 1;
      else if (value[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          spans.push([m.index, i]);
          break;
        }
      }
    }
  }
  return spans;
}

/** An exemption marker on the declaration or the line above it. */
const EXEMPT = /not-a-control/;

export function offenders(files: readonly { path: string; source: string }[], rankOf: Map<number, string>): Offender[] {
  const out: Offender[] = [];
  for (const { path, source } of files) {
    const lines = source.split('\n');
    lines.forEach((line, i) => {
      const d = DECL.exec(line);
      if (!d) return;
      // A box that happens to be rank-sized but is artwork: a fixed-aspect preview, a glyph.
      if (EXEMPT.test(line) || (i > 0 && EXEMPT.test(lines[i - 1]))) return;
      const value = d[2];
      const spans = varSpans(value);
      for (const m of value.matchAll(LEN)) {
        const token = rankOf.get(Number(m[1]));
        if (!token) continue;
        if (spans.some(([a, b]) => a < m.index && m.index < b)) continue;
        out.push({ file: path, line: i + 1, text: line.trim(), token });
      }
    });
  }
  return out;
}

function walk(dir: string, into: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, into);
    // Foundations is the token showcase: its literals are the subject, not a lapse.
    else if (p.endsWith('.css') && !p.includes('.stories.') && !p.includes('/Foundations/')) into.push(p);
  }
  return into;
}

if (process.argv[1]?.endsWith('check-controls.ts')) {
  const root = join(import.meta.dirname, '..');
  const rankOf = ranks(readFileSync(join(root, 'packages/theme/src/generated/tokens.css'), 'utf8'));
  if (rankOf.size === 0) throw new Error('no control ranks in the generated tokens; has the theme been built?');
  const files = walk(join(root, 'packages/ui/src')).map((path) => ({
    path: relative(root, path),
    source: readFileSync(path, 'utf8'),
  }));
  const bad = offenders(files, rankOf);
  for (const o of bad) console.error(`${o.file}:${o.line}  use var(--wzl-${o.token})  ${o.text}`);
  console.log(`${files.length} stylesheets, ${bad.length} frozen control height(s)`);
  process.exit(bad.length === 0 ? 0 : 1);
}
