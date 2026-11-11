/**
 * Property tests for the z-order primitives: each returns a permutation, keeps the moved ids in their order, and
 * changes the list exactly when its `can*` predicate says it would.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import {
  bringForward, bringToFront, canBringForward, canSendBackward, moveToIndex, sendBackward, sendToBack,
} from './algorithms';

const N = 300;
const T = timeoutFor(N, 1);

/** A list of unique ids, some picked to move, plus a few strays the list does not hold. */
const setup = fc.integer({ min: 0, max: 12 }).chain((n) => {
  const list = Array.from({ length: n }, (_, i) => `n${i}`);
  return fc.record({
    list: fc.shuffledSubarray(list, { minLength: n, maxLength: n }),
    ids: fc.array(fc.oneof({ weight: 5, arbitrary: n > 0 ? fc.constantFrom(...list) : fc.constant('n0') }, fc.constant('stray')), { maxLength: 8 }),
  });
});

const sameMembers = (a: readonly string[], b: readonly string[]) => expect([...a].sort()).toEqual([...b].sort());
const reverse = (xs: readonly string[]) => [...xs].reverse();

describe('reorder primitives', () => {
  it('every primitive is a permutation that keeps the moved ids, and the rest, in their own order', () => {
    fc.assert(fc.property(setup, fc.integer({ min: -3, max: 15 }), ({ list, ids }, index) => {
      const moving = new Set(ids);
      const order = (xs: readonly string[], keep: (id: string) => boolean) => xs.filter(keep);
      for (const out of [bringForward(list, ids), sendBackward(list, ids), bringToFront(list, ids), sendToBack(list, ids), moveToIndex(list, ids, index)]) {
        sameMembers(out, list);
        expect(order(out, (id) => moving.has(id))).toEqual(order(list, (id) => moving.has(id)));
        expect(order(out, (id) => !moving.has(id))).toEqual(order(list, (id) => !moving.has(id)));
      }
    }), runs(N));
  }, T);

  it('bringForward and sendBackward change the list exactly when canBringForward and canSendBackward say so', () => {
    const t = tally();
    fc.assert(fc.property(setup, ({ list, ids }) => {
      const fwd = bringForward(list, ids);
      const back = sendBackward(list, ids);
      expect(fwd.some((id, i) => id !== list[i])).toBe(canBringForward(list, ids));
      expect(back.some((id, i) => id !== list[i])).toBe(canSendBackward(list, ids));
      t.count(canBringForward(list, ids) ? 'can' : 'cannot');
    }), runs(N));
    t.atLeast('can', N / 5);
    t.atLeast('cannot', N / 20);
  }, T);

  it('each moved id goes up (down) at most one place past a still neighbor, never down (up), and the two are mirrors', () => {
    fc.assert(fc.property(setup, ({ list, ids }) => {
      const moving = new Set(ids);
      const fwd = bringForward(list, ids);
      const back = sendBackward(list, ids);
      for (const id of list) {
        if (!moving.has(id)) continue;
        const was = list.indexOf(id);
        expect(fwd.indexOf(id) - was).toBeGreaterThanOrEqual(0);
        expect(fwd.indexOf(id) - was).toBeLessThanOrEqual(1);
        expect(was - back.indexOf(id)).toBeGreaterThanOrEqual(0);
        expect(was - back.indexOf(id)).toBeLessThanOrEqual(1);
      }
      expect(sendBackward(reverse(list), ids)).toEqual(reverse(fwd));
      expect(sendToBack(reverse(list), ids)).toEqual(reverse(bringToFront(list, ids)));
      expect(canSendBackward(reverse(list), ids)).toBe(canBringForward(list, ids));
    }), runs(N));
  }, T);

  it('front and back are idempotent, and moveToIndex puts the moved block at the clamped index of what stays', () => {
    fc.assert(fc.property(setup, fc.integer({ min: -3, max: 15 }), ({ list, ids }, index) => {
      const front = bringToFront(list, ids);
      expect(bringToFront(front, ids)).toEqual(front);
      expect(canBringForward(front, ids)).toBe(false);
      const back = sendToBack(list, ids);
      expect(sendToBack(back, ids)).toEqual(back);
      expect(canSendBackward(back, ids)).toBe(false);
      const moving = new Set(ids);
      const kept = list.filter((id) => !moving.has(id));
      const moved = list.filter((id) => moving.has(id));
      const at = Math.max(0, Math.min(kept.length, index));
      expect(moveToIndex(list, ids, index).slice(at, at + moved.length)).toEqual(moved);
      expect(moveToIndex(list, ids, kept.length)).toEqual(front);
      expect(moveToIndex(list, ids, 0)).toEqual(back);
    }), runs(N));
  }, T);
});
