/**
 * Lexical scanning shared by the stylesheet parser and the at-rule condition
 * evaluators: strings, comments, balanced blocks, top-level splitting, and
 * single declarations.
 */

/** One `prop: value [!important]` declaration. */
export interface Declaration {
  readonly prop: string;
  readonly value: string;
  readonly important: boolean;
}

/**
 * Advance past a quoted string starting at `i` (which holds the quote).
 * Returns the index just after the closing quote, or the end of input.
 */
export function skipString(s: string, i: number): number {
  const q = s[i];
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') j++;
    else if (s[j] === q) return j + 1;
  }
  return s.length;
}

/** Remove `/* … *\/` comments, leaving quoted strings intact. */
export function stripComments(s: string): string {
  if (!s.includes('/*')) return s;
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === "'") {
      const end = skipString(s, i);
      out += s.slice(i, end);
      i = end;
    } else if (ch === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      i = end < 0 ? s.length : end + 2;
      out += ' ';
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/**
 * Split `s` on `sep` wherever it sits outside strings and (), [] nesting.
 * With `dropBlocks`, a `{…}` block at depth zero is discarded along with the
 * prelude before it, back to the previous separator.
 */
export function splitTopLevel(s: string, sep: string, dropBlocks = false): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === "'") { i = skipString(s, i); continue; }
    if (ch === '(' || ch === '[') depth++;
    else if ((ch === ')' || ch === ']') && depth > 0) depth--;
    else if (depth === 0 && ch === sep) {
      parts.push(s.slice(start, i));
      start = i + 1;
    } else if (depth === 0 && dropBlocks && ch === '{') {
      i = skipBlock(s, i);
      start = i;
      continue;
    }
    i++;
  }
  parts.push(s.slice(start));
  return parts;
}

/** Given `s[i] === '{'`, return the index just after its matching `}`. */
export function skipBlock(s: string, i: number): number {
  let depth = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === "'") { i = skipString(s, i); continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i + 1;
    i++;
  }
  return s.length;
}

const PROP_NAME = /^-?[a-z_][a-z0-9_-]*$/;
const IMPORTANT = /!\s*important\s*$/i;

/**
 * Parse a CSS declaration block — a `style=""` value or a rule body — in
 * source order. Malformed declarations are dropped, as CSS does.
 */
export function parseDeclarations(block: string): Declaration[] {
  const out: Declaration[] = [];
  for (const part of splitTopLevel(stripComments(block), ';', true)) {
    const d = parseDeclaration(part);
    if (d) out.push(d);
  }
  return out;
}

/** Parse one `prop: value [!important]`, or null when it is malformed. */
export function parseDeclaration(text: string): Declaration | null {
  const colon = text.indexOf(':');
  if (colon < 0) return null;
  const prop = text.slice(0, colon).trim().toLowerCase();
  if (!PROP_NAME.test(prop)) return null;
  let value = text.slice(colon + 1).trim();
  const important = IMPORTANT.test(value);
  if (important) value = value.replace(IMPORTANT, '').trim();
  if (!value) return null;
  return { prop, value, important };
}

/** Given `s[i] === '('`, return the index just after its matching `)`. */
export function parenEnd(s: string, i: number): number {
  let depth = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === "'") { i = skipString(s, i); continue; }
    if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return i + 1;
    i++;
  }
  return s.length;
}

