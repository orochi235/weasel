/**
 * The boolean grammar `@media` and `@supports` share: `not`, `and`, `or` and
 * parenthesized nesting, with `and` and `or` never mixed at one level. The
 * leaves differ, so each caller supplies its own.
 *
 * Values are three-valued (Kleene): `null` is "unknown", which Media Queries 4
 * gives to anything it cannot parse as a feature, and which stays unknown
 * under `not`. A syntax error throws {@link ConditionSyntaxError}.
 */

import { parenEnd } from './cssScan';

export type Tri = boolean | null;

export class ConditionSyntaxError extends Error {}

export interface ConditionLeaves {
  /** A parenthesized leaf whose contents are not themselves a condition. */
  paren(inner: string): Tri;
  /** A function-notation leaf, `name(args)`; `name` is lowercased. */
  fn(name: string, args: string): Tri;
}

export const triNot = (a: Tri): Tri => (a == null ? null : !a);
export const triAnd = (a: Tri, b: Tri): Tri => (a === false || b === false ? false : a == null || b == null ? null : true);
const triOr = (a: Tri, b: Tri): Tri => (a === true || b === true ? true : a == null || b == null ? null : false);

interface Cursor {
  readonly s: string;
  i: number;
}

const WS = /\s/;
const IDENT = /^-?[a-zA-Z_][\w-]*/;

function skipWs(p: Cursor): void {
  while (p.i < p.s.length && WS.test(p.s[p.i])) p.i++;
}

/** Consume `word` when it stands alone as a keyword followed by whitespace. */
function keyword(p: Cursor, word: string): boolean {
  const end = p.i + word.length;
  if (p.s.slice(p.i, end).toLowerCase() !== word) return false;
  if (end >= p.s.length || !WS.test(p.s[end])) return false;
  p.i = end;
  return true;
}

/**
 * Evaluate a whole condition. `allowOr: false` is the
 * `<media-condition-without-or>` that follows `<media-type> and`.
 */
export function evaluateCondition(s: string, leaves: ConditionLeaves, allowOr = true): Tri {
  const p: Cursor = { s, i: 0 };
  const r = condition(p, leaves, allowOr);
  skipWs(p);
  if (p.i < s.length) throw new ConditionSyntaxError(`unexpected "${s.slice(p.i)}"`);
  return r;
}

function condition(p: Cursor, leaves: ConditionLeaves, allowOr: boolean): Tri {
  skipWs(p);
  if (keyword(p, 'not')) return triNot(inParens(p, leaves));
  let r = inParens(p, leaves);
  let op: 'and' | 'or' | null = null;
  for (;;) {
    const save = p.i;
    skipWs(p);
    if (p.i >= p.s.length) { p.i = save; return r; }
    const next = keyword(p, 'and') ? 'and' : keyword(p, 'or') ? 'or' : null;
    if (!next || (op && next !== op) || (next === 'or' && !allowOr)) {
      throw new ConditionSyntaxError(`unexpected "${p.s.slice(p.i)}"`);
    }
    op = next;
    const rhs = inParens(p, leaves);
    r = op === 'and' ? triAnd(r, rhs) : triOr(r, rhs);
  }
}

function looksLikeCondition(inner: string): boolean {
  const t = inner.trimStart();
  return t.startsWith('(') || /^not\s/i.test(t) || /^-?[a-zA-Z_][\w-]*\(/.test(t);
}

function inParens(p: Cursor, leaves: ConditionLeaves): Tri {
  skipWs(p);
  const start = p.i;
  let name: string | null = null;
  if (p.s[p.i] !== '(') {
    const m = IDENT.exec(p.s.slice(p.i));
    if (!m || p.s[p.i + m[0].length] !== '(') throw new ConditionSyntaxError(`expected "(" at "${p.s.slice(p.i)}"`);
    name = m[0].toLowerCase();
    p.i += m[0].length;
  }
  const end = parenEnd(p.s, p.i);
  if (p.s[end - 1] !== ')') throw new ConditionSyntaxError(`unbalanced "${p.s.slice(start)}"`);
  const inner = p.s.slice(p.i + 1, end - 1);
  p.i = end;
  if (name != null) return leaves.fn(name, inner);
  if (looksLikeCondition(inner)) {
    try {
      return evaluateCondition(inner, leaves);
    } catch (e) {
      if (!(e instanceof ConditionSyntaxError)) throw e;
    }
  }
  return leaves.paren(inner);
}
