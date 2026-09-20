/**
 * A `gap`, `padding` or `margin` written as a px literal that the space ladder
 * already has a rung for. The ladder is what carries spacing across density, so
 * a literal here is a hole: it stays put while everything around it moves.
 *
 * Only those three properties. `border`, `outline` and `box-shadow` are not
 * spacing and are meant to stay put, and a `var()` fallback is the default of
 * the property it belongs to — `var(--slider-thumb-size, 8px)` is a thumb, not
 * a gap — so both are left alone.
 *
 * Runs under tsx so theme modules resolve through the root tsconfig's paths to
 * source, with no build first.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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
const DECL = new RegExp(`(?:^|[{;])\\s*(${PROPS})\\s*:\\s*([^;}]*)[;}]`);
/** Not preceded by a minus, digit or dot: skips -4px and 1.5px. */
const LEN = /(?<![-\d.])(\d+)px/g;

export interface Offender {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  readonly rung: string;
}

/** Index ranges covered by a `var()` fallback. */
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

export function offenders(files: readonly { path: string; source: string }[], rungs: Map<number, string>): Offender[] {
  const out: Offender[] = [];
  for (const { path, source } of files) {
    source.split('\n').forEach((line, i) => {
      const d = DECL.exec(line);
      if (!d) return;
      const value = d[2];
      const spans = varSpans(value);
      for (const m of value.matchAll(LEN)) {
        const rung = rungs.get(Number(m[1]));
        if (!rung) continue;
        if (spans.some(([a, b]) => a < m.index && m.index < b)) continue;
        out.push({ file: path, line: i + 1, text: line.trim(), rung });
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

if (process.argv[1]?.endsWith('check-spacing.ts')) {
  const root = join(import.meta.dirname, '..');
  const rungs = ladder(readFileSync(join(root, 'packages/theme/src/generated/tokens.css'), 'utf8'));
  if (rungs.size === 0) throw new Error('no --wzl-space-<n> rungs in the generated tokens; has the theme been built?');
  const files = walk(join(root, 'packages/ui/src')).map((path) => ({
    path: relative(root, path),
    source: readFileSync(path, 'utf8'),
  }));
  const bad = offenders(files, rungs);
  for (const o of bad) console.error(`${o.file}:${o.line}  use var(--wzl-space-${o.rung})  ${o.text}`);
  console.log(`${files.length} stylesheets, ${bad.length} spacing literal(s) with a rung`);
  process.exit(bad.length === 0 ? 0 : 1);
}
