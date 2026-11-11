/**
 * Property tests of the key readers and tab order: `arrowSteps`, `arrowMove`, and `rangeKey` against a table of
 * what each key means, mirrored under rtl; `editEnd` and `imeKey`; `tabSort` as a stable sort, and `tabStep`
 * against walking the order, from a target in it or one that left it.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { tabSort, tabStep } from './focus';
import { COARSE_STEPS, arrowMove, arrowSteps, rangeKey } from './keySteps';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { editEnd, imeKey } from './textCommit';

const RUNS = 400;
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Enter', 'Escape', 'a', ' ', 'Tab', 'Process', 'Dead'];

describe('key steps', () => {
  it('arrows step one or ten, toward Up and the inline end, Page by ten, Home and End to the ends', () => {
    fc.assert(fc.property(fc.constantFrom(...KEYS), fc.boolean(), fc.constantFrom('ltr', 'rtl' as const), (key, shift, dir) => {
      const n = shift ? COARSE_STEPS : 1;
      const inlineEnd = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const inlineStart = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
      const steps = key === 'ArrowUp' || key === inlineEnd ? n : key === 'ArrowDown' || key === inlineStart ? -n : null;
      expect(arrowSteps(key, shift, dir)).toBe(steps);
      const range = key === 'PageUp' ? COARSE_STEPS : key === 'PageDown' ? -COARSE_STEPS : key === 'Home' ? 'home' : key === 'End' ? 'end' : steps;
      expect(rangeKey(key, shift, dir)).toBe(range);
      const move = arrowMove(key, shift);
      const ltr = arrowSteps(key, shift);
      if (ltr === null) expect(move).toBeNull();
      else if (key === 'ArrowLeft' || key === 'ArrowRight') expect(move).toEqual({ dx: ltr, dy: 0 });
      else expect(move).toEqual({ dx: 0, dy: -ltr });
    }), runs(RUNS));
  }, timeoutFor(RUNS, 3));
});

describe('text commit', () => {
  it('Enter and blur commit, Shift+Enter is a line break in a multiline field, Escape does what the field says', () => {
    fc.assert(fc.property(
      fc.oneof(fc.constant('blur' as const), fc.record({ key: fc.constantFrom(...KEYS), shift: fc.option(fc.boolean(), { nil: undefined }) })),
      fc.record({ escape: fc.option(fc.constantFrom('commit', 'cancel' as const), { nil: undefined }), multiline: fc.option(fc.boolean(), { nil: undefined }) }),
      (cause, shape) => {
        const want = cause === 'blur' ? 'commit'
          : cause.key === 'Enter' ? (shape.multiline && cause.shift ? null : 'commit')
            : cause.key === 'Escape' ? (shape.escape ?? 'cancel') : null;
        expect(editEnd(cause, shape)).toBe(want);
      },
    ), runs(RUNS));
  }, timeoutFor(RUNS, 3));

  it('an input method owns a composing key, keyCode 229, Process, and Dead, and nothing else', () => {
    fc.assert(fc.property(
      fc.constantFrom(...KEYS), fc.option(fc.boolean(), { nil: undefined }), fc.option(fc.constantFrom(13, 27, 229, 65), { nil: undefined }),
      (key, isComposing, keyCode) => {
        expect(imeKey({ key, isComposing, keyCode })).toBe(isComposing === true || keyCode === 229 || key === 'Process' || key === 'Dead');
      },
    ), runs(RUNS));
  }, timeoutFor(RUNS, 3));
});

describe('tab order', () => {
  const declared = fc.array(fc.option(fc.integer({ min: 1, max: 4 }), { nil: undefined }), { maxLength: 10 });

  it('tabSort puts declared places first, ascending and stable, then the rest as given', () => {
    fc.assert(fc.property(declared, (places) => {
      const targets = places.map((place, i) => ({ i, place }));
      const got = tabSort(targets, (x) => x.place).map((x) => x.i);
      const placed = targets.filter((x) => x.place !== undefined);
      const want = [
        ...[1, 2, 3, 4].flatMap((p) => placed.filter((x) => x.place === p).map((x) => x.i)),
        ...targets.filter((x) => x.place === undefined).map((x) => x.i),
      ];
      expect(got).toEqual(want);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 3));

  it('tabStep walks the order, blurs past either end, and steps from where a target that left it sat', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 10 }).chain((n) => fc.tuple(
        fc.constant(n), fc.subarray(Array.from({ length: n }, (_, i) => i)),
        fc.option(fc.integer({ min: 0, max: Math.max(0, n - 1) }), { nil: null }),
      )),
      fc.constantFrom('next', 'prev' as const), fc.boolean(),
      ([n, order, from], direction, withPlace) => {
        if (n === 0) from = null;
        const isBefore = withPlace ? (a: number, b: number) => a < b : undefined;
        const got = tabStep(order, from, direction, isBefore);
        const forward = direction === 'next';
        const here = from === null ? -1 : order.indexOf(from);
        let want: number | null;
        if (here >= 0) { want = order[here + (forward ? 1 : -1)] ?? null; t.count(want === null ? 'blur' : 'step'); }
        else if (from === null || !isBefore) { want = forward ? (order[0] ?? null) : (order.at(-1) ?? null); t.count('enter'); }
        else {
          want = forward ? (order.find((x) => x > from!) ?? null) : (order.filter((x) => x < from!).at(-1) ?? null);
          t.count('left');
        }
        expect(got).toBe(want);
      },
    ), runs(RUNS));
    for (const k of ['step', 'blur', 'enter', 'left']) t.atLeast(k, RUNS / 20);
  }, timeoutFor(RUNS, 3));
});
