import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const blank = (text: string): string => text.replace(/[^\n]/g, ' ');

/**
 * Comments blanked to spaces, so indices and line numbers survive. A quoted string is code: a `/*` or `//` inside
 * one opens nothing. A `'` or `"` string ends at a line break, as CSS and TypeScript both end it, so a stray quote
 * costs one line. `//` after a `:` is a URL scheme, not a comment.
 */
export function stripComments(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    const next = source[i + 1];
    let end: number;
    if (c === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2);
      end = close < 0 ? source.length : close + 2;
      out += blank(source.slice(i, end));
    } else if (c === '/' && next === '/' && source[i - 1] !== ':') {
      const eol = source.indexOf('\n', i);
      end = eol < 0 ? source.length : eol;
      out += blank(source.slice(i, end));
    } else if (c === "'" || c === '"' || c === '`') {
      end = i + 1;
      while (end < source.length && source[end] !== c && (c === '`' || source[end] !== '\n')) end += source[end] === '\\' ? 2 : 1;
      if (source[end] === c) end += 1;
      end = Math.min(end, source.length);
      out += source.slice(i, end);
    } else {
      end = i + 1;
      out += c;
    }
    i = end;
  }
  return out;
}

/** Index ranges of `value` covered by a `var()`, fallback included: a length there belongs to the property the
 *  variable names, not the one declaring it. */
export function varSpans(value: string): [number, number][] {
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

export function lineAt(source: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index; i += 1) if (source.charCodeAt(i) === 10) n += 1;
  return n;
}

export interface Block {
  /** The block's own prelude last, preceded by those of the blocks it nests in. */
  readonly selectors: string[];
  readonly decls: { text: string; index: number }[];
}

/** Each block's own declarations — nested blocks are their own entries. */
export function blocks(source: string): Block[] {
  const out: Block[] = [];
  const stack: Block[] = [];
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    if (c !== '{' && c !== '}' && c !== ';') continue;
    const raw = source.slice(start, i);
    const text = raw.trim();
    const index = start + raw.length - raw.trimStart().length;
    if (c === '{') {
      const outer = stack[stack.length - 1]?.selectors ?? [];
      stack.push({ selectors: [...outer, text.replace(/\s+/g, ' ')], decls: [] });
    }
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

const SKIP = new Set(['node_modules', 'dist', 'dist-demo', 'dist-examples', 'generated', 'storybook-static']);

export function walk(dir: string, into: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, into);
    else if (/\.(css|less|tsx?)$/.test(p) && !/\.(test|spec)\.tsx?$/.test(p) && !p.endsWith('.d.ts')) into.push(p);
  }
  return into;
}
