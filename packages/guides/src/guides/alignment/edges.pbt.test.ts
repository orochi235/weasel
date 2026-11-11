/**
 * Second-pass properties of the alignment and spacing math at the edges of its input: boxes with non-finite or
 * huge coordinates among good ones, tolerances that are not lengths, coincident boxes, and the order boxes come in.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Bounds } from '@weasel-js/core';
import { box, eighth, runs, tally, timeoutFor } from '../../pbt.fixture';
import { alignmentSnapSource } from '../../sources/alignment';
import { spacingSnapSource } from '../../sources/spacing';
import { moveBy, sceneOf } from '../../sources/testing/session';
import { deriveAlignmentGuides } from './derive';
import { matchSpacing, measureGaps } from './spacing';

const RUNS = runs(200);
const TIMEOUT = timeoutFor(200, 10);

const bad = fc.constantFrom(NaN, Infinity, -Infinity);
/** A box with at least one coordinate that is not finite. */
const badBox: fc.Arbitrary<Bounds> = fc.tuple(box(60, 30), fc.constantFrom('x', 'y', 'width', 'height' as const), bad)
  .map(([b, k, v]) => ({ ...b, [k]: v }));
const boxes = fc.array(box(60, 30, 1), { minLength: 1, maxLength: 6 });

const offsets = (gs: ReturnType<typeof deriveAlignmentGuides>, axis: 'x' | 'y') => gs.filter((g) => g.axis === axis).map((g) => g.offset).sort((a, b) => a - b);

describe('alignment and spacing at the edges, property', () => {
  it('a box with a coordinate that is not finite offers no line, and leaves every other box\'s lines as they were', () => {
    fc.assert(fc.property(boxes, fc.array(badBox, { minLength: 1, maxLength: 3 }), fc.nat(), (good, worse, at) => {
      const mixed = [...good];
      for (const b of worse) mixed.splice(at % (mixed.length + 1), 0, b);
      const want = deriveAlignmentGuides(good);
      const got = deriveAlignmentGuides(mixed);
      for (const g of got) expect(Number.isFinite(g.offset)).toBe(true);
      expect(offsets(got, 'x')).toEqual(offsets(want, 'x'));
      expect(offsets(got, 'y')).toEqual(offsets(want, 'y'));
    }), RUNS);
  }, TIMEOUT);

  it('a moved box snaps among siblings alike with a sibling at a coordinate that is not finite among them', () => {
    const t = tally();
    fc.assert(fc.property(box(30, 30, 1), boxes, badBox, eighth(30), eighth(30), (moving, others, worse, dx, dy) => {
      const run = (sibs: readonly Bounds[]) => {
        const { scene, ids } = sceneOf([moving, ...sibs]);
        return moveBy({ sources: [alignmentSnapSource(), spacingSnapSource()], scene, ids: [ids[0]!], reachPx: 8 }).by(dx, dy).point;
      };
      const want = run(others);
      expect(run([...others, worse])).toEqual(want);
      expect(run([worse, ...others])).toEqual(want);
      t.count(want.x !== dx || want.y !== dy ? 'snapped' : 'free');
    }), RUNS);
    t.atLeast('snapped', 40);
  }, TIMEOUT);

  it('the lines derived, and the gaps measured, do not depend on the order boxes come in', () => {
    fc.assert(fc.property(boxes, fc.infiniteStream(fc.nat()), (bs, picks) => {
      const shuffled = [...bs];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = picks.next().value % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
      }
      for (const axis of ['x', 'y'] as const) {
        const key = (g: { min: number; max: number; at: number }) => `${g.min},${g.max},${g.at}`;
        expect(measureGaps(shuffled, axis).map(key).sort()).toEqual(measureGaps(bs, axis).map(key).sort());
      }
      // Lines within 1e-3 merge, placed by the first box found, so compare only where offsets stand apart.
      const xs = offsets(deriveAlignmentGuides(bs), 'x');
      if (xs.every((v, i) => i === 0 || v - xs[i - 1]! > 2e-3)) expect(offsets(deriveAlignmentGuides(shuffled), 'x')).toEqual(xs);
    }), RUNS);
  }, TIMEOUT);

  it('matchSpacing snaps nowhere under a tolerance that is not a length', () => {
    fc.assert(fc.property(box(60, 20, 1), boxes, fc.constantFrom(NaN, -1, -Infinity), (b, targets, tol) => {
      const out = matchSpacing(b, targets, { x: tol, y: tol });
      expect([out.dx, out.dy]).toEqual([0, 0]);
      expect([...out.gapsX, ...out.gapsY]).toEqual([]);
    }), RUNS);
  }, TIMEOUT);

  it('coincident boxes measure the gaps one of them does', () => {
    fc.assert(fc.property(boxes, fc.nat(), (bs, pick) => {
      const twin = bs[pick % bs.length]!;
      for (const axis of ['x', 'y'] as const) {
        const one = new Set(measureGaps(bs, axis).map((g) => `${g.min},${g.max},${g.at}`));
        const two = new Set(measureGaps([...bs, { ...twin }], axis).map((g) => `${g.min},${g.max},${g.at}`));
        expect([...two].sort()).toEqual([...one].sort());
      }
    }), RUNS);
  }, TIMEOUT);
});
