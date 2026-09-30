/**
 * Numeric text takes its face from one place: `.numeric` in
 * `@weasel-js/theme/numeric.module.css`. A rule restating the pair drifts from
 * it, and `tabular-nums` on its own aligns nothing in Oswald, which has no
 * tabular figures. So this fails on:
 *
 *   - `tabular-nums` or a read of `--wzl-font-numeric` anywhere but that module —
 *     a stylesheet composes it (`composes: numeric from …`), Less mixes it in
 *     (`.numeric();`), and TSX puts its class on the element;
 *   - a rule that takes the helper and also sets `font`, `font-family` or
 *     `font-variant-numeric`. A composed class is declared before the rule that
 *     composes it, so any of those in the same rule quietly replaces it.
 *
 * Runs under tsx so it shares the root tsconfig's resolution, like its siblings.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface Offender {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  readonly why: string;
}

const HOME = 'packages/theme/src/numeric.module.css';
const TAKES_HELPER = /^composes:\s*numeric\s+from\s|^\.numeric\(\)$/;
const FONT_PROP = /^(font|font-family|font-variant-numeric)\s*:/;
/** A read, not a definition: a theme or a font switcher may still declare the token. */
const STRAY = /tabular-nums|var\(\s*--wzl-font-numeric\b/;

/** Comments blanked to spaces, so indices and line numbers survive. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|(?<![:'"])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

function lineAt(source: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index; i += 1) if (source.charCodeAt(i) === 10) n += 1;
  return n;
}

/** Each block's own declarations — nested blocks are their own entries. */
function blocks(source: string): { decls: { text: string; index: number }[] }[] {
  const out: { decls: { text: string; index: number }[] }[] = [];
  const stack: { decls: { text: string; index: number }[] }[] = [];
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    if (c !== '{' && c !== '}' && c !== ';') continue;
    const raw = source.slice(start, i);
    const text = raw.trim();
    const index = start + raw.length - raw.trimStart().length;
    if (c === '{') stack.push({ decls: [] });
    else {
      if (text && stack.length > 0) stack[stack.length - 1].decls.push({ text, index });
      if (c === '}') {
        const done = stack.pop();
        if (done) out.push(done);
      }
    }
    start = i + 1;
  }
  return out;
}

export function styleOffenders(path: string, source: string): Offender[] {
  if (path === HOME) return [];
  const clean = stripComments(source);
  const out: Offender[] = [];
  for (const { decls } of blocks(clean)) {
    const helper = decls.some((d) => TAKES_HELPER.test(d.text));
    for (const d of decls) {
      const at = { file: path, line: lineAt(clean, d.index), text: d.text };
      if (STRAY.test(d.text)) out.push({ ...at, why: 'compose .numeric from @weasel-js/theme/numeric.module.css instead' });
      else if (helper && FONT_PROP.test(d.text)) out.push({ ...at, why: 'replaces the numeric face this rule composes' });
    }
  }
  return out;
}

export function scriptOffenders(path: string, source: string): Offender[] {
  const clean = stripComments(source);
  const out: Offender[] = [];
  clean.split('\n').forEach((line, i) => {
    if (/fontVariantNumeric/.test(line) || STRAY.test(line))
      out.push({ file: path, line: i + 1, text: line.trim(), why: "put the numeric module's class on the element instead" });
  });
  return out;
}

const SKIP = new Set(['node_modules', 'dist', 'dist-demo', 'dist-examples', 'generated', 'storybook-static']);

function walk(dir: string, into: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, into);
    else if (/\.(css|less|tsx?)$/.test(p) && !/\.(test|spec)\.tsx?$/.test(p) && !p.endsWith('.d.ts')) into.push(p);
  }
  return into;
}

if (process.argv[1]?.endsWith('check-numeric.ts')) {
  const root = join(import.meta.dirname, '..');
  const files = [...walk(join(root, 'packages')), ...walk(join(root, 'apps'))].map((p) => relative(root, p));
  const bad = files.flatMap((p) => {
    const source = readFileSync(join(root, p), 'utf8');
    return /\.(css|less)$/.test(p) ? styleOffenders(p, source) : scriptOffenders(p, source);
  });
  for (const o of bad) console.error(`${o.file}:${o.line}  ${o.why}  ${o.text}`);
  console.log(`${files.length} files, ${bad.length} numeric-type offender(s)`);
  process.exit(bad.length === 0 ? 0 : 1);
}
