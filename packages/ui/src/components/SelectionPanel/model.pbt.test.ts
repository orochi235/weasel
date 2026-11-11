/**
 * Property tests of the selection panel's value plumbing: `setAtPath` writes a copy holding the value at its path
 * and everything else as it was, `nodeValueAt` reads it back, and reads only what a node holds as its own (keys
 * named like `Object.prototype`'s included); `sharedValue` is one value only when all agree; `kindBreakdown`
 * counts every kind once, in first-seen order.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { SceneNode } from '@weasel-js/core';
import { key, runs, tally, timeoutFor } from '../../pbt.fixture';
import { MIXED, kindBreakdown, nodeValueAt, setAtPath, sharedValue } from './model';

const RUNS = 400;

const seg = key.filter((k) => k !== '' && !k.includes('.'));
const leafValue = fc.oneof(fc.integer(), fc.string({ maxLength: 3 }), fc.boolean(), fc.constant(null));
/** Plain objects and arrays, keys set as own keys. */
const value = fc.letrec<{ v: unknown }>((tie) => ({
  v: fc.oneof({ depthSize: 'small' }, leafValue,
    fc.array(tie('v'), { maxLength: 3 }),
    fc.uniqueArray(fc.tuple(seg, tie('v')), { selector: (e) => e[0], maxLength: 3 }).map((es) => {
      const o: Record<string, unknown> = {};
      for (const [k, v] of es) Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
      return o;
    })),
})).v;
const objectValue = value.filter((v): v is object => v !== null && typeof v === 'object' && !Array.isArray(v));
const path = fc.array(fc.oneof(seg, fc.constantFrom('0', '1')), { minLength: 1, maxLength: 3 });
/** A root holding an array, and a path into it. */
const intoArray = fc.tuple(seg, fc.array(value, { maxLength: 3 }), fc.oneof(fc.constantFrom('0', '1', '__proto__'), seg), fc.option(seg, { nil: undefined }))
  .map(([k, arr, i, deeper]) => {
    const root: Record<string, unknown> = {};
    Object.defineProperty(root, k, { value: arr, enumerable: true, writable: true, configurable: true });
    return [root, deeper === undefined ? [k, i] : [k, i, deeper]] as [object, string[]];
  });
const rootAndPath = fc.oneof(fc.tuple(objectValue, path), intoArray);

/** What `root` holds at `segments`, own keys only. */
function ownAt(root: unknown, segments: readonly string[]): unknown {
  let at = root;
  for (const s of segments) {
    if (at === null || typeof at !== 'object' || !Object.hasOwn(at, s)) return undefined;
    at = (at as Record<string, unknown>)[s];
  }
  return at;
}

/** Every leaf path in `v`, own keys only. */
function leaves(v: unknown, at: string[] = []): string[][] {
  if (v === null || typeof v !== 'object') return [at];
  const ks = Object.keys(v);
  return ks.length === 0 ? [at] : ks.flatMap((k) => leaves((v as Record<string, unknown>)[k], [...at, k]));
}

const node = (data: unknown) => ({ id: 'n', kind: 'leaf', data, pose: { x: 1 } }) as unknown as SceneNode<unknown, string, unknown>;

describe('setAtPath and nodeValueAt', () => {
  it('write a copy holding the value at its path, everything not on the path as it was, and the root untouched', () => {
    const t = tally();
    fc.assert(fc.property(rootAndPath, leafValue, ([root, segs], v) => {
      const before = structuredClone(root);
      const out = setAtPath(root, segs, v);
      expect(root).toEqual(before);
      expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
      expect(ownAt(out, segs)).toBe(v);
      expect(nodeValueAt(node(out), ['data', ...segs].join('.'))).toBe(v);
      for (const p of leaves(root)) {
        const shares = p.every((s, i) => i >= segs.length || s === segs[i]);
        if (shares && p.length >= segs.length) continue;
        if (segs.every((s, i) => i >= p.length || s === p[i])) continue;
        expect(ownAt(out, p)).toEqual(ownAt(root, p));
        t.count('kept');
      }
      if (segs.some((s) => s === '__proto__' || s === 'constructor' || s === 'toString')) t.count('proto-named');
      if (Array.isArray(ownAt(root, segs.slice(0, -1)))) {
        t.count('array');
        expect(Array.isArray(ownAt(out, segs.slice(0, -1)))).toBe(true);
      }
    }), runs(RUNS));
    t.atLeast('kept', 100);
    t.atLeast('proto-named', 50);
    t.atLeast('array', 10);
  }, timeoutFor(RUNS, 1));

  it('reads only what the node holds as its own', () => {
    const t = tally();
    const dataAndPath = objectValue.chain((data) => fc.tuple(fc.constant(data), fc.oneof(path, fc.constantFrom(...leaves(data)).map((p) => (p.length > 0 ? p : ['x'])))));
    fc.assert(fc.property(dataAndPath, ([data, segs]) => {
      const want = ownAt(data, segs);
      expect(nodeValueAt(node(data), ['data', ...segs].join('.'))).toBe(want);
      t.count(want === undefined ? 'absent' : 'held');
    }), runs(RUNS));
    t.atLeast('absent', 100);
    t.atLeast('held', 15);
  }, timeoutFor(RUNS, 1));
});

describe('sharedValue and kindBreakdown', () => {
  it('give the one value all agree on, else MIXED, whatever the order', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(fc.oneof(value, fc.constant(1)), { minLength: 1, maxLength: 4 }), fc.nat(), (vs, rot) => {
      const got = sharedValue(vs);
      const agree = vs.every((v) => JSON.stringify(v) === JSON.stringify(vs[0]));
      expect(got === MIXED).toBe(!agree);
      if (agree) expect(got).toBe(vs[0]);
      const k = rot % vs.length;
      expect(sharedValue([...vs.slice(k), ...vs.slice(0, k)]) === MIXED).toBe(!agree);
      t.count(agree ? 'shared' : 'mixed');
    }), runs(RUNS));
    t.atLeast('shared', 50);
    t.atLeast('mixed', 50);
  }, timeoutFor(RUNS, 1));

  it('counts each kind once, in the order first seen', () => {
    fc.assert(fc.property(fc.array(fc.constantFrom('rect', 'text', 'path', 'constructor', '__proto__'), { maxLength: 8 }), (kinds) => {
      const parts = kindBreakdown(kinds) === '' ? [] : kindBreakdown(kinds).split(' · ');
      const firsts = [...new Set(kinds)];
      expect(parts.map((p) => p.split(' ×')[0])).toEqual(firsts);
      parts.forEach((p, i) => {
        const n = kinds.filter((k) => k === firsts[i]).length;
        expect(p).toBe(n > 1 ? `${firsts[i]} ×${n}` : firsts[i]);
      });
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('node values, shrunk counterexamples', () => {
  it('reads a key named like a prototype member as absent when the node does not hold it', () => {
    expect(nodeValueAt(node({}), 'data.toString')).toBeUndefined();
    expect(nodeValueAt(node({}), 'data.constructor.name')).toBeUndefined();
  });

  it('writes __proto__ into an array as an own key, keeping the array an array', () => {
    const out = setAtPath({ a: [1] }, ['a', '__proto__'], { x: 1 }) as { a: unknown[] };
    expect(Object.getPrototypeOf(out.a)).toBe(Array.prototype);
    expect(Object.hasOwn(out.a, '__proto__')).toBe(true);
  });
});
