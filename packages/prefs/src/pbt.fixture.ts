/**
 * fast-check arbitraries shared by prefs' property tests: leaves of every value-holding built-in kind, a value
 * each admits, what a stored value may be, and a check that a value is one the leaf admits. Test-only: nothing
 * in the package imports it.
 */
import fc from 'fast-check';
import { isPlainObject } from '@weasel-js/registry';
import type { PrefList } from './list';
import type { PrefMap } from './map';
import type { PrefBoolean, PrefColor, PrefEnum, PrefField, PrefLeaf, PrefNumber, PrefObject, PrefString } from './schema';
import type { PrefUnion } from './union';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** How often each path ran, so a property that exercised nothing fails rather than passes. */
export function tally(): { count(what: string): void; atLeast(what: string, n: number): void } {
  const seen = new Map<string, number>();
  return {
    count(what) { seen.set(what, (seen.get(what) ?? 0) + 1); },
    atLeast(what, n) {
      if ((seen.get(what) ?? 0) < n) throw new Error(`${what} ran ${seen.get(what) ?? 0} times, wanted ${n}: ${JSON.stringify([...seen])}`);
    },
  };
}

/** A key a map entry or an object field may be stored under, `__proto__` and the scope keys included. */
export const key = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom('a', 'b', 'c', 'width', 'type') },
  { weight: 1, arbitrary: fc.constantFrom('__proto__', 'constructor', '$by', '$in', '$else', '$at', 'value') },
  { weight: 1, arbitrary: fc.string({ maxLength: 4 }) },
);

/** An object built with own keys only, as `JSON.parse` builds one: a `__proto__` key is a key. */
export const own = (entries: readonly (readonly [string, unknown])[]): Record<string, unknown> => Object.fromEntries(entries);

/** Anything a record may hold: JSON, the infinity strings the store writes, and objects keyed by anything. */
export const stored: fc.Arbitrary<unknown> = fc.letrec<{ v: unknown }>((tie) => ({
  v: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constantFrom(null, undefined, true, false, 0, -0, 1, -1, 0.5, NaN, Infinity, -Infinity, 'Infinity', '-Infinity', '', 'a', '#ff0000'),
    fc.double(),
    fc.string({ maxLength: 6 }),
    fc.array(tie('v'), { maxLength: 4 }),
    fc.array(fc.tuple(key, tie('v')), { maxLength: 4 }).map(own),
  ),
})).v;

const NAMES = ['a', 'b', 'c', 'd'] as const;
const base = { name: 'L', description: '' };

const numberLeaf: fc.Arbitrary<PrefNumber> = fc
  .record({
    lo: fc.option(fc.integer({ min: -100, max: 100 }), { nil: undefined }),
    span: fc.integer({ min: 0, max: 200 }),
    hasMax: fc.boolean(),
    endless: fc.constantFrom(undefined, 'min', 'max', 'both'),
    clearable: fc.boolean(),
    at: fc.double({ min: 0, max: 1, noNaN: true }),
  })
  .map(({ lo, span, hasMax, endless, clearable, at }) => {
    const min = lo;
    const max = hasMax ? (lo ?? 0) + span : undefined;
    const from = min ?? (max !== undefined ? max - span : -50);
    const to = max ?? from + span;
    const leaf: Record<string, unknown> = { kind: 'number', ...base, default: from + (to - from) * at };
    if (min !== undefined) leaf.min = min;
    if (max !== undefined) leaf.max = max;
    if (endless !== undefined) leaf.endless = endless;
    if (clearable) leaf.clearable = true;
    return leaf as unknown as PrefNumber;
  });

const enumLeaf: fc.Arbitrary<PrefEnum> = fc
  .record({ options: fc.uniqueArray(fc.constantFrom('x', 'y', 'z', '', '__proto__'), { minLength: 1, maxLength: 4 }), clearable: fc.boolean(), pick: fc.nat() })
  .map(({ options, clearable, pick }) => ({
    kind: 'enum', ...base,
    options: options.map((value) => ({ value, label: value })),
    ...(clearable ? { clearable: true, default: undefined } : { default: options[pick % options.length]! }),
  }) as PrefEnum);

const scalarLeaf: fc.Arbitrary<PrefLeaf> = fc.oneof(
  numberLeaf,
  fc.boolean().map((d): PrefBoolean => ({ kind: 'boolean', ...base, default: d })),
  fc.string({ maxLength: 4 }).map((d): PrefString => ({ kind: 'string', ...base, default: d })),
  fc.constant<PrefColor>({ kind: 'color', ...base, default: '#000000' }),
  fc.constant<PrefField>({ kind: 'field', ...base, default: '' }),
  enumLeaf,
);

const children = (inner: fc.Arbitrary<PrefLeaf>): fc.Arbitrary<Record<string, PrefLeaf>> =>
  fc.uniqueArray(fc.tuple(fc.constantFrom(...NAMES, '__proto__'), inner), { maxLength: 3, selector: ([k]) => k }).map(own) as fc.Arbitrary<Record<string, PrefLeaf>>;

/** An object leaf over `fields`, its default a valid value of them. */
const objectOf = (fields: Record<string, PrefLeaf>): PrefObject => ({
  kind: 'object', ...base, children: fields,
  default: own(Object.entries(fields).filter(([, f]) => f.default !== undefined).map(([k, f]) => [k, f.default])),
});

/** A leaf of any value-holding built-in kind but `paint`, nested `depth` deep at most. */
export function leaf(depth = 2): fc.Arbitrary<PrefLeaf> {
  if (depth <= 0) return scalarLeaf;
  const inner = leaf(depth - 1);
  return fc.oneof(
    { weight: 3, arbitrary: scalarLeaf },
    { weight: 1, arbitrary: children(inner).map(objectOf) },
    {
      weight: 1,
      arbitrary: fc.record({ item: inner, minItems: fc.option(fc.nat(2), { nil: undefined }), extra: fc.option(fc.nat(3), { nil: undefined }) }).map(({ item, minItems, extra }): PrefList => ({
        kind: 'list', ...base, item, default: Array.from({ length: minItems ?? 0 }, () => item.default),
        ...(minItems !== undefined ? { minItems } : {}), ...(extra !== undefined ? { maxItems: (minItems ?? 0) + extra } : {}),
      })),
    },
    { weight: 1, arbitrary: inner.map((item): PrefMap => ({ kind: 'map', ...base, item, default: {} })) },
    {
      weight: 1,
      arbitrary: fc.uniqueArray(fc.tuple(fc.constantFrom('p', 'q', '__proto__'), children(inner)), { minLength: 1, maxLength: 3, selector: ([k]) => k }).map((variants): PrefUnion => {
        const [first, fields] = variants[0]!;
        return {
          kind: 'union', ...base, tag: 'type',
          variants: own(variants.map(([k, f]) => [k, objectOf(f)])) as Record<string, PrefObject>,
          default: { ...objectOf(fields).default as object, type: first },
        };
      }),
    },
  );
}

/** Whether `value` is one `leaf` admits as what it reads: what a repaired value must be. */
export function admits(leaf: PrefLeaf, value: unknown): boolean {
  if (Object.is(value, leaf.default) || (value === undefined && leaf.default === undefined)) return true;
  switch (leaf.kind) {
    case 'number': {
      const n = leaf as PrefNumber;
      if (typeof value !== 'number' || Number.isNaN(value)) return false;
      if (value === Infinity && (n.endless === 'max' || n.endless === 'both')) return true;
      if (value === -Infinity && (n.endless === 'min' || n.endless === 'both')) return true;
      return Number.isFinite(value) && (n.min === undefined || value >= n.min) && (n.max === undefined || value <= n.max);
    }
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
    case 'color':
    case 'field':
      return typeof value === 'string';
    case 'enum':
      return (leaf as PrefEnum).options.some((o) => o.value === value);
    case 'object':
      return isPlainObject(value) && fieldsAdmit(leaf as PrefObject, value);
    case 'map':
      return isPlainObject(value) && Object.values(value).every((v) => admits((leaf as PrefMap).item, v));
    case 'union': {
      const u = leaf as PrefUnion;
      if (!isPlainObject(value)) return false;
      const tag = value[u.tag];
      return typeof tag === 'string' && Object.hasOwn(u.variants, tag) && fieldsAdmit(u.variants[tag]!, value);
    }
    case 'list': {
      const l = leaf as PrefList;
      return Array.isArray(value) && value.length >= (l.minItems ?? 0) && value.length <= (l.maxItems ?? Infinity) && value.every((v) => admits(l.item, v));
    }
    default:
      return true;
  }
}

const fieldsAdmit = (leaf: PrefObject, value: Record<string, unknown>): boolean =>
  Object.entries(leaf.children).every(([k, f]) => !Object.hasOwn(value, k) || value[k] === undefined || admits(f as PrefLeaf, value[k]));

/** A value `leaf` admits, other than its default where one is easy to make. */
export function valueOf(leaf: PrefLeaf): fc.Arbitrary<unknown> {
  switch (leaf.kind) {
    case 'number': {
      const n = leaf as PrefNumber;
      const ends: number[] = [];
      if (n.endless === 'max' || n.endless === 'both') ends.push(Infinity);
      if (n.endless === 'min' || n.endless === 'both') ends.push(-Infinity);
      const lo = n.min ?? -1e6;
      const hi = n.max ?? 1e6;
      const inside = fc.oneof(fc.double({ min: lo, max: hi, noNaN: true, noDefaultInfinity: true }), fc.constantFrom(lo, hi));
      return ends.length ? fc.oneof(inside, fc.constantFrom(...ends)) : inside;
    }
    case 'boolean':
      return fc.boolean();
    case 'string':
    case 'field':
      return fc.string({ maxLength: 6 });
    case 'color':
      return fc.constantFrom('#000000', '#ff8800', '#12345678');
    case 'enum':
      return fc.constantFrom(...(leaf as PrefEnum).options.map((o) => o.value));
    case 'object':
      return fieldsOf(leaf as PrefObject);
    case 'map':
      return fc.array(fc.tuple(key, valueOf((leaf as PrefMap).item)), { maxLength: 3 }).map(own);
    case 'union': {
      const u = leaf as PrefUnion;
      return fc.constantFrom(...Object.keys(u.variants)).chain((tag) => fieldsOf(u.variants[tag]!).map((v) => own([...Object.entries(v), [u.tag, tag]])));
    }
    case 'list': {
      const l = leaf as PrefList;
      return fc.array(valueOf(l.item), { minLength: l.minItems ?? 0, maxLength: l.maxItems ?? (l.minItems ?? 0) + 3 });
    }
    default:
      return fc.constant(leaf.default);
  }
}

const fieldsOf = (leaf: PrefObject): fc.Arbitrary<Record<string, unknown>> =>
  fc.tuple(...Object.entries(leaf.children).map(([k, f]) => fc.option(valueOf(f as PrefLeaf), { nil: undefined }).map((v) => [k, v] as const)))
    .map((pairs) => own(pairs.filter(([, v]) => v !== undefined)));

/** Equality that reads `-0` as `0`, as JSON storage does. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b || (Number.isNaN(a) && Number.isNaN(b));
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && sameValue(a[k], b[k]));
  }
  return Object.is(a, b);
}
