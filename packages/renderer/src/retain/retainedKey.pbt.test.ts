import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mat3, type GlMat3 } from '@weasel-js/geom';
import type { DrawCommand } from '../DrawCommand';
import { affine, runs, spread, tally } from '../pbt.fixture';
import { keepKey, keyShift, sameKey, type RetainedKey } from './retainedKey';

const CHILDREN: DrawCommand[][] = [[], []];
const PATHS = [{ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 }, { kind: 'rect' as const, x: 5, y: 5, width: 1, height: 1 }];

const key: fc.Arbitrary<RetainedKey> = fc.record({
  child: fc.integer({ min: 0, max: 1 }),
  transform: affine, alpha: fc.constantFrom(1, 0.5),
  view: fc.option(affine, { nil: undefined, freq: 2 }),
  clips: fc.array(fc.record({ path: fc.integer({ min: 0, max: 1 }), transform: affine }), { maxLength: 2 }),
  isolate: fc.option(fc.boolean(), { nil: undefined }),
}).map((k) => ({
  children: CHILDREN[k.child]!, transform: k.transform, alpha: k.alpha, colorMatrix: new Float32Array(20),
  viewMatrix: k.view, clips: k.clips.map((c) => ({ path: PATHS[c.path]!, transform: c.transform })),
  ...(k.isolate === undefined ? {} : { isolate: k.isolate }),
}));

const moved = (m: GlMat3, dx: number, dy: number): GlMat3 => mat3.fromAffine([m[0]!, m[1]!, m[3]!, m[4]!, m[6]! + dx, m[7]! + dy]);

/** `k` with everything it was drawn under moved by `(dx, dy)` on screen. */
function shifted(k: RetainedKey, dx: number, dy: number): RetainedKey {
  return {
    ...k, transform: moved(k.transform, dx, dy),
    viewMatrix: k.viewMatrix && moved(k.viewMatrix, dx, dy),
    clips: k.clips.map((c) => ({ ...c, transform: moved(c.transform, dx, dy) })),
  };
}

describe('retained keys, property', () => {
  it('keeps a copy equal to the key that no later write to its matrices reaches', () => {
    fc.assert(fc.property(key, (k) => {
      const kept = keepKey(k);
      expect(sameKey(kept, k)).toBe(true);
      expect(keyShift(kept, k)).toEqual([0, 0]);
      k.transform[6] += 1;
      k.colorMatrix[0] = 2;
      for (const c of k.clips) c.transform[0] += 1;
      expect(sameKey(kept, k)).toBe(false);
      expect(kept.transform[6]).not.toBe(k.transform[6]);
    }), runs(300));
  });

  it('measures the move between a key and itself moved, either way round', () => {
    const t = tally();
    fc.assert(fc.property(key, spread(-500, 500), spread(-500, 500), (k, dx, dy) => {
      const b = shifted(k, dx, dy);
      const there = keyShift(k, b), back = keyShift(b, k);
      t.count(k.viewMatrix || k.clips.length > 0 ? 'with view or clips' : 'bare');
      expect(there).not.toBeNull();
      expect(back).not.toBeNull();
      const tol = 1e-9 * (1 + Math.abs(k.transform[6]!) + Math.abs(k.transform[7]!) + Math.abs(dx) + Math.abs(dy));
      expect(Math.abs(there![0] - dx)).toBeLessThanOrEqual(tol);
      expect(Math.abs(there![1] - dy)).toBeLessThanOrEqual(tol);
      expect(Math.abs(back![0] + there![0])).toBeLessThanOrEqual(tol);
      expect(Math.abs(back![1] + there![1])).toBeLessThanOrEqual(tol);
      expect(sameKey(k, b)).toBe(dx === 0 && dy === 0);
    }), runs(300));
    t.atLeast('with view or clips', 100);
    t.atLeast('bare', 20);
  });

  it('finds no move between keys that differ in anything but a common translation', () => {
    const t = tally();
    fc.assert(fc.property(key, fc.constantFrom('children', 'alpha', 'linear', 'view only', 'clip only', 'isolate'), spread(1, 50), (k, what, d) => {
      let b: RetainedKey = shifted(k, d, 0);
      if (what === 'children') b = { ...b, children: k.children === CHILDREN[0] ? CHILDREN[1]! : CHILDREN[0]! };
      if (what === 'alpha') b = { ...b, alpha: k.alpha === 1 ? 0.5 : 1 };
      if (what === 'linear') b = { ...b, transform: mat3.fromAffine([b.transform[0]! * 2, b.transform[1]!, b.transform[3]!, b.transform[4]!, b.transform[6]!, b.transform[7]!]) };
      if (what === 'isolate') b = { ...b, isolate: !k.isolate };
      if (what === 'view only') {
        if (!k.viewMatrix) return;
        b = { ...b, viewMatrix: moved(k.viewMatrix, 2 * d, 0) };
      }
      if (what === 'clip only') {
        if (k.clips.length === 0) return;
        b = { ...b, clips: [{ ...b.clips[0]!, transform: moved(k.clips[0]!.transform, 2 * d, 0) }, ...b.clips.slice(1)] };
      }
      t.count(what);
      expect(keyShift(k, b)).toBeNull();
      expect(sameKey(k, b)).toBe(false);
    }), runs(300));
    for (const k of ['children', 'alpha', 'linear', 'view only', 'clip only', 'isolate']) t.atLeast(k, 8);
  });
});
