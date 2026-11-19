/**
 * Hostile input for the readers of outside data: JSON-ish junk, a valid value with one field dropped, duplicated or
 * retyped, and very long text with a time budget. Test-only: no package source imports it.
 */
import fc from 'fast-check';

/** Keys a reader might trip on: prototype names, the codec's tags, and ordinary ones. */
const hostileKey = fc.constantFrom('__proto__', 'constructor', 'prototype', 'toString', 'valueOf', '__ta', '__num', '__raw',
  'data', 'commands', 'coords', 'id', 'kind', 'layer', 'pose', 'parent', 'nodes', 'version', 'format', '', '0');

/** A leaf no reader should take on trust: non-finite and huge numbers, odd strings, every JSON scalar. */
export const hostileLeaf: fc.Arbitrary<unknown> = fc.oneof(
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0, 1e308, -1e308, 2 ** 53, 5e-324),
  fc.double(),
  fc.integer(),
  fc.string({ maxLength: 8 }),
  fc.constantFrom('', 'NaN', 'Infinity', '-0', 'u8', 'f32', 'mark', 'group', 'children', '__proto__'),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
);

/** An object with these own keys, `__proto__` included as an own key, as `JSON.parse` makes it. */
export function ownObject(entries: readonly (readonly [string, unknown])[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  return out;
}

/** JSON-ish junk: arrays and objects of hostile leaves under hostile keys. */
export const junk: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof({ depthSize: 'small', withCrossShrink: true }, hostileLeaf, tie('array'), tie('object')),
  array: fc.array(tie('value'), { maxLength: 4 }),
  object: fc.uniqueArray(fc.tuple(fc.oneof(hostileKey, fc.string({ maxLength: 4 })), tie('value')), { selector: ([k]) => k, maxLength: 5 })
    .map(ownObject),
})).value;

/** Every path to a value inside `v`, arrays and plain objects walked. */
export function pathsOf(v: unknown, at: readonly (string | number)[] = []): (string | number)[][] {
  const out: (string | number)[][] = [[...at]];
  if (Array.isArray(v)) v.forEach((x, i) => out.push(...pathsOf(x, [...at, i])));
  else if (v !== null && typeof v === 'object' && !ArrayBuffer.isView(v)) {
    for (const k of Object.keys(v)) out.push(...pathsOf((v as Record<string, unknown>)[k], [...at, k]));
  }
  return out;
}

/** One change to a valid value. */
export type Mutation =
  | { op: 'drop' }
  | { op: 'duplicate' }
  | { op: 'retype'; to: unknown };

export const mutation: fc.Arbitrary<Mutation> = fc.oneof(
  fc.constant({ op: 'drop' } as const),
  fc.constant({ op: 'duplicate' } as const),
  fc.oneof(hostileLeaf, junk, fc.constant([]), fc.constant({})).map((to) => ({ op: 'retype', to }) as const),
);

const clone = (v: unknown): unknown => JSON.parse(JSON.stringify(v)) as unknown;

/** A copy of JSON value `v` with the value at `path` dropped (removed from its array or object), duplicated (an
 *  array entry twice, an object field wrapped in a two-entry array) or retyped (replaced). The root retyped is `to`. */
export function mutate(v: unknown, path: readonly (string | number)[], m: Mutation): unknown {
  if (path.length === 0) return m.op === 'retype' ? m.to : m.op === 'drop' ? undefined : [clone(v), clone(v)];
  const root = clone(v);
  let parent = root as Record<string | number, unknown>;
  for (const step of path.slice(0, -1)) parent = parent[step] as Record<string | number, unknown>;
  const last = path[path.length - 1]!;
  if (Array.isArray(parent)) {
    const i = last as number;
    if (m.op === 'drop') parent.splice(i, 1);
    else if (m.op === 'duplicate') parent.splice(i, 0, clone(parent[i]));
    else parent[i] = m.to;
  } else if (m.op === 'drop') delete parent[last];
  else if (m.op === 'duplicate') parent[last] = [parent[last], clone(parent[last])];
  else parent[last] = m.to;
  return root;
}

/** A valid JSON value from `valid`, changed once at one of its paths. */
export function mutated(valid: fc.Arbitrary<unknown>): fc.Arbitrary<{ value: unknown; path: (string | number)[]; m: Mutation }> {
  return valid.chain((v) => {
    const paths = pathsOf(v);
    return fc.tuple(fc.constantFrom(...paths), mutation).map(([path, m]) => ({ value: mutate(v, path, m), path, m }));
  });
}

/** Whether anything set a field on `Object.prototype`, as a reader that assigns `__proto__` would. */
export function prototypePolluted(): boolean {
  return Object.getOwnPropertyNames(Object.prototype).some((k) => !BASELINE.has(k));
}
const BASELINE = new Set(Object.getOwnPropertyNames(Object.prototype));

/** How long {@link longText} is: past anything typed, short enough that a quadratic reader shows. */
export const LONG = 20_000;

/** Pieces a backtracking pattern over numbers, spaces, brackets and separators trips on. */
const PIECES = ['1', '1.', '.1', '1e', '0', ' ', '\t', '-', '+', ',', ';', ':', '(', ')', '[', ']', '{', '}', '"', "'", '\\', '*', '%',
  '#', '&', '<', 'a', 'a ', '1 ', '1px ', 'e'];

/** A piece repeated to {@link LONG} characters, then a tail that makes most patterns fail only at the end. `text`
 *  wraps it, so a reader can be reached through the syntax around it. */
export function longText(text: (run: string) => string = (run) => run, pieces: readonly string[] = PIECES): fc.Arbitrary<string> {
  return fc.tuple(fc.constantFrom(...pieces), fc.constantFrom('', 'x', '!', ')', ']', ' ', '%'))
    .map(([piece, tail]) => text(piece.repeat(Math.ceil(LONG / piece.length)) + tail));
}

/** `read()`, failing when it takes longer than `budgetMs`: a linear reader takes a millisecond or two on {@link LONG}
 *  characters, a quadratic one hundreds. */
export function quick<T>(read: () => T, budgetMs = 100): T {
  const t0 = performance.now();
  const out = read();
  const took = performance.now() - t0;
  if (took > budgetMs) throw new Error(`took ${took.toFixed(0)} ms, past the ${budgetMs} ms budget`);
  return out;
}
