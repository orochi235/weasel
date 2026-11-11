/**
 * An index page's config: `mergeConfig` against a model of deep merging, own keys named like `Object.prototype`
 * members included, and `withValueAt` writing one dotted path and leaving everything off it alone; and the variant
 * rows of random schemas naming only boolean and enum leaves, in schema order, at most `MAX_ROWS` of them.
 */
import { isPlainObject } from '@weasel-js/core';
import { f } from '@weasel-js/labkit/config';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { json, key, runs, tally } from '../../pbt.fixture';
import { MAX_ENUM_OPTIONS, MAX_ROWS, mergeConfig, variantRows, withValueAt } from './variants';

const RUNS = 300;

function setOwn(target: Record<string, unknown>, k: string, value: unknown): Record<string, unknown> {
  Object.defineProperty(target, k, { value, enumerable: true, writable: true, configurable: true });
  return target;
}

/** Nested JSON objects over the shared key pool, so merges meet the same keys at several depths. */
const nested: fc.Arbitrary<unknown> = fc.letrec<{ node: unknown }>((tie) => ({
  node: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    json,
    fc.array(fc.tuple(key, tie('node')), { maxLength: 3 }).map((pairs) => pairs.reduce<Record<string, unknown>>((o, [k, v]) => setOwn(o, k, v), {})),
  ),
})).node;

function merged(base: unknown, over: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(over)) return over === undefined ? base : over;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(base)) setOwn(out, k, v);
  for (const [k, v] of Object.entries(over)) setOwn(out, k, merged(Object.hasOwn(base, k) ? base[k] : undefined, v));
  return out;
}

const keysDeep = (v: unknown): unknown =>
  isPlainObject(v) ? Object.entries(v).map(([k, x]) => [k, keysDeep(x)]) : v;

describe('mergeConfig', () => {
  it('merges nested plain objects as the model does, own keys of every name kept, and changes neither input', () => {
    fc.assert(
      fc.property(nested, nested, (base, over) => {
        const before = JSON.stringify([keysDeep(base), keysDeep(over)]);
        const got = mergeConfig(base, over);
        expect(keysDeep(got)).toEqual(keysDeep(merged(base, over)));
        expect(JSON.stringify([keysDeep(base), keysDeep(over)])).toBe(before);
        expect(keysDeep(mergeConfig(got, over))).toEqual(keysDeep(got));
      }),
      runs(RUNS),
    );
  });
});

describe('withValueAt', () => {
  it('writes the value at its dotted path, copies the objects along it, and leaves the rest alone', () => {
    const seen = tally();
    fc.assert(
      fc.property(nested, fc.array(key.filter((k) => !k.includes('.')), { minLength: 1, maxLength: 3 }), json, fc.boolean(), (drawn, segments, value, along) => {
        // Half the time the path already runs through objects holding other keys.
        const config = along ? segments.slice(0, -1).reduceRight<unknown>((inner, k) => setOwn({ zz: 1 }, k, inner), drawn) : drawn;
        const before = JSON.stringify(keysDeep(config));
        const got = withValueAt(config, segments.join('.'), value);
        expect(JSON.stringify(keysDeep(config))).toBe(before);
        let at: unknown = got;
        let was: unknown = config;
        for (const [i, segment] of segments.entries()) {
          expect(isPlainObject(at) && Object.hasOwn(at, segment)).toBe(true);
          const holder = at as Record<string, unknown>;
          const old = isPlainObject(was) ? was : {};
          // Every other key at this level is as it was.
          for (const [k, v] of Object.entries(old)) if (k !== segment) expect(keysDeep(holder[k])).toEqual(keysDeep(v));
          expect(Object.keys(holder).filter((k) => k !== segment).sort()).toEqual(Object.keys(old).filter((k) => k !== segment).sort());
          if (i === segments.length - 1) expect(holder[segment]).toBe(value);
          at = holder[segment];
          was = Object.hasOwn(old, segment) ? old[segment] : undefined;
          if (isPlainObject(was) && i < segments.length - 1) seen.count('went through');
        }
      }),
      runs(RUNS),
    );
    seen.atLeast('went through', 10);
  });
});

type Leaf = { kind: 'boolean' } | { kind: 'enum'; n: number } | { kind: 'string' };
type Shape = { [k: string]: Leaf | Shape };
const leaf: fc.Arbitrary<Leaf> = fc.oneof(
  fc.constant({ kind: 'boolean' as const }),
  fc.integer({ min: 1, max: MAX_ENUM_OPTIONS + 2 }).map((n) => ({ kind: 'enum' as const, n })),
  fc.constant({ kind: 'string' as const }),
);
const schemaKey = fc.constantFrom('a', 'b', 'size', 'label', 'constructor', 'toString', 'valueOf');
const shape: fc.Arbitrary<Shape> = fc.letrec<{ shape: Shape }>((tie) => ({
  shape: fc
    .uniqueArray(fc.tuple(schemaKey, fc.oneof({ depthSize: 'small' }, leaf, leaf, tie('shape'))), { selector: ([k]) => k, maxLength: 4 })
    .map((pairs) => pairs.reduce<Shape>((o, [k, v]) => setOwn(o, k, v) as Shape, {})),
})).shape;

const isLeaf = (v: Leaf | Shape): v is Leaf => typeof (v as Leaf).kind === 'string' && !Object.hasOwn(v, 'a') && Object.keys(v).every((k) => k === 'kind' || k === 'n');

function build(s: Shape): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    let node: unknown;
    if (!isLeaf(v)) node = f.group(build(v) as never);
    else if (v.kind === 'boolean') node = f.boolean(false);
    else if (v.kind === 'string') node = f.string('');
    else node = f.enum('o0', Array.from({ length: v.n }, (_, i) => `o${i}`) as [string, ...string[]]);
    setOwn(out, k, node);
  }
  return out;
}

/** The leaves a row can vary along, in schema order. */
function expectedRows(s: Shape, at = ''): string[] {
  return Object.entries(s).flatMap(([k, v]) => {
    const path = at === '' ? k : `${at}.${k}`;
    if (!isLeaf(v)) return expectedRows(v, path);
    if (v.kind === 'boolean') return [path];
    if (v.kind === 'enum' && v.n >= 2 && v.n <= MAX_ENUM_OPTIONS) return [path];
    return [];
  });
}

describe('variantRows', () => {
  it('names the boolean and enum leaves of a random schema in schema order, at most MAX_ROWS', () => {
    const seen = tally();
    fc.assert(
      fc.property(shape, (s) => {
        const rows = variantRows(f.schema(build(s) as never));
        expect(rows.map((r) => r.path)).toEqual(expectedRows(s).slice(0, MAX_ROWS));
        for (const row of rows) expect(row.values.length).toBeGreaterThanOrEqual(2);
        if (rows.some((r) => r.path.includes('.'))) seen.count('nested');
        if (expectedRows(s).length > MAX_ROWS) seen.count('capped');
      }),
      runs(RUNS),
    );
    seen.atLeast('nested', 20);
    seen.atLeast('capped', 3);
  });
});
