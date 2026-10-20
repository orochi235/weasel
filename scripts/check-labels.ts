/**
 * A label on a params surface that restates the label recipe instead of
 * inheriting it. Any rule setting `text-transform` there is a cased label, and
 * must read `--wzl-params-label-case` and `--wzl-params-label-tracking` so a
 * consumer can override both from any ancestor. A literal is a copy, and copies
 * drift: this repo had five, at three different trackings.
 *
 * The fallbacks are checked too — case must default to `uppercase` and tracking
 * to a `--wzl-tracking-*` token — or the drift simply moves into the fallback.
 *
 * A row label's size is held the same way: a rule on a row label that sets
 * `font-size` reads `--wzl-params-text-size`, the property the row's value is
 * set by too, so the two cannot come apart. The browser tests
 * (`paramsTextSize.browser.test.tsx`, `ControlPanel.textSize.browser.test.tsx`)
 * check the value side, which no stylesheet scan can see.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** The surfaces whose labels inherit. Add a directory to bring one under the rule. */
export const SURFACES = [
  'packages/ui/src/components/Properties',
  'packages/ui/src/components/MotifFrame',
  'packages/ui/src/components/DetailList',
  'packages/ui/src/components/Prefs',
  'packages/ui/src/components/SelectionPanel',
  'packages/labkit/src/controls',
];

export const CASE = /^var\(--wzl-params-label-case,\s*uppercase\)$/;
export const TRACKING = /^var\(--wzl-params-label-tracking,\s*var\(--wzl-tracking-[a-z]+\)\)$/;
export const TEXT_SIZE = /^var\(--wzl-params-text-size,\s*var\(--wzl-font-size-sm\)\)$/;
/** A selector whose subject is a row label: the class each surface gives one. */
const ROW_LABEL = /\.(?:rowLabel|lk-pair-label)(?![\w-])[^\s>+~]*$/;
/** A stanced surface's title reads the recipe through its stance slots, whose
 *  fallback `stanceCss.test.ts` holds to the same two patterns. */
const STANCE_CASE = /^var\(--_s-title-case\)$/;
const STANCE_TRACKING = /^var\(--_s-title-tracking\)$/;

export interface Offender {
  readonly file: string;
  readonly line: number;
  readonly problem: string;
}

/** Rule bodies with their selectors and the line each starts on. Comments are blanked first, keeping line numbers. */
function rules(source: string): { selector: string; body: string; line: number }[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '');
  const out: { selector: string; body: string; line: number }[] = [];
  let depth = 0;
  let start = 0;
  let selector = '';
  let after = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '{') {
      depth += 1;
      start = i;
      selector = text.slice(after, i).trim();
      after = i + 1;
    } else if (text[i] === '}') {
      if (depth > 0) out.push({ selector, body: text.slice(start + 1, i), line: text.slice(0, start).split('\n').length });
      depth = Math.max(0, depth - 1);
      after = i + 1;
    } else if (text[i] === ';') {
      after = i + 1;
    }
  }
  return out;
}

const namesRowLabel = (selector: string) => selector.split(',').some((part) => ROW_LABEL.test(part.trim()));

function decl(body: string, prop: string): string | undefined {
  return new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(body)?.[1].trim();
}

export function offenders(files: readonly { path: string; source: string }[]): Offender[] {
  const out: Offender[] = [];
  for (const { path, source } of files) {
    for (const { selector, body, line } of rules(source)) {
      const size = decl(body, 'font-size');
      if (size !== undefined && namesRowLabel(selector) && !TEXT_SIZE.test(size)) {
        out.push({ file: path, line, problem: `row label font-size: ${size} — use var(--wzl-params-text-size, var(--wzl-font-size-sm))` });
      }
      const transform = decl(body, 'text-transform');
      if (transform === undefined) continue;
      if (STANCE_CASE.test(transform) && STANCE_TRACKING.test(decl(body, 'letter-spacing') ?? '')) continue;
      if (!CASE.test(transform)) {
        out.push({ file: path, line, problem: `text-transform: ${transform} — use var(--wzl-params-label-case, uppercase)` });
      }
      const tracking = decl(body, 'letter-spacing');
      if (tracking === undefined) {
        out.push({ file: path, line, problem: 'cased label sets no letter-spacing — use var(--wzl-params-label-tracking, var(--wzl-tracking-*))' });
      } else if (!TRACKING.test(tracking)) {
        out.push({ file: path, line, problem: `letter-spacing: ${tracking} — use var(--wzl-params-label-tracking, var(--wzl-tracking-*))` });
      }
    }
  }
  return out;
}

function walk(dir: string, into: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, into);
    else if (/\.(css|less)$/.test(p) && !p.includes('.stories.')) into.push(p);
  }
  return into;
}

if (process.argv[1]?.endsWith('check-labels.ts')) {
  const root = join(import.meta.dirname, '..');
  const files = SURFACES.flatMap((s) => walk(join(root, s))).map((path) => ({
    path: relative(root, path),
    source: readFileSync(path, 'utf8'),
  }));
  const bad = offenders(files);
  for (const o of bad) console.error(`${o.file}:${o.line}  ${o.problem}`);
  console.log(`${files.length} stylesheets, ${bad.length} label rule(s) restating the recipe`);
  process.exit(bad.length === 0 ? 0 : 1);
}
