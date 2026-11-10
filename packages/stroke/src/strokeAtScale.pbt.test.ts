import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { resolveScreenLength, type MarkerRef, type ScreenLength, type Stroke } from '@weasel-js/paint';
import { strokeAtScale } from './strokeAtScale';
import { runs, tally } from './pbt.fixture';

const RUNS = runs(300);
const len = fc.double({ min: 0, max: 100, noNaN: true });
const screenLength: fc.Arbitrary<ScreenLength> = fc.oneof(len, len.map((px) => ({ px })));
const marker: fc.Arbitrary<MarkerRef | undefined> = fc.option(fc.oneof(
  fc.constant('arrow'),
  fc.record({ key: fc.constant('arrow'), size: fc.option(screenLength, { nil: undefined }) }),
), { nil: undefined });
const stroke: fc.Arbitrary<Stroke> = fc.record({
  width: screenLength,
  dash: fc.option(fc.array(len, { minLength: 1, maxLength: 4 }), { nil: undefined }),
  dashOffset: fc.option(len, { nil: undefined }),
  markerStart: marker,
  markerEnd: marker,
}).map((s) => ({ paint: { color: '#000' }, ...s }));
const scale = fc.oneof(
  fc.double({ min: 1e-3, max: 1e3, noNaN: true }),
  fc.constantFrom(0, Infinity, -Infinity, Number.NaN, -2),
);

describe('strokeAtScale, property', () => {
  it('resolves every { px } length at the scale, and moves a { px } width\'s dashes with it', () => {
    const scaled = tally();
    fc.assert(fc.property(stroke, scale, (s, k) => {
      const out = strokeAtScale(s, k);
      expect(out.width).toBe(resolveScreenLength(s.width!, k));
      for (const role of ['markerStart', 'markerEnd'] as const) {
        const ref = s[role];
        if (typeof ref === 'object' && typeof ref.size === 'object') {
          expect((out[role] as { size: number }).size).toBe(resolveScreenLength(ref.size, k));
        } else {
          expect(out[role]).toEqual(ref);
        }
      }
      if (typeof s.width !== 'object') {
        expect(out.dash).toEqual(s.dash);
        expect(out.dashOffset).toEqual(s.dashOffset);
        return;
      }
      // The pattern keeps its proportion to the width it was drawn against.
      if (!(s.width.px > 1e-6)) return;
      const ratio = out.width / s.width.px;
      const close = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThanOrEqual(1e-12 * (1 + Math.abs(want)));
      s.dash?.forEach((d, i) => close(out.dash![i]!, d * ratio));
      if (s.dashOffset !== undefined) close(out.dashOffset!, s.dashOffset * ratio);
      if (s.dash || s.dashOffset !== undefined) scaled.hit();
    }), RUNS);
    scaled.atLeast(0.03, RUNS.numRuns);
  });

  it('leaves a { px } width\'s dashes as given under an infinite scale, as it leaves the width (shrunk counterexample)', () => {
    const out = strokeAtScale({ paint: { color: '#000' }, width: { px: 2 }, dash: [4, 2], dashOffset: 1 }, Infinity);
    expect(out).toMatchObject({ width: 2, dash: [4, 2], dashOffset: 1 });
  });

  it('leaves a stroke it has resolved as it is, at any scale', () => {
    fc.assert(fc.property(stroke, scale, scale, (s, k, j) => {
      const once = strokeAtScale(s, k);
      expect(strokeAtScale(once, j)).toEqual(once);
    }), RUNS);
  });
});
