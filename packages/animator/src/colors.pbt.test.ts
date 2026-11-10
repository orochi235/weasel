/**
 * The vertex color helpers: the default interpolator's endpoints, a cycle as a rotation of its base
 * colors, and a staggered change anchor by anchor against its own delay.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ColorSpace } from '@weasel-js/paint';
import { rainbowVertexColors, solidVertexColors } from './colorArrays';
import { cycleVertexColors } from './colorCycle';
import { staggerVertexColors } from './colorHelpers';
import type { ColorOverrideFn } from './colorRegistry';
import { resolveInterpolator } from './colorInterpolate';
import { clocked, rgbaArray, runs, tally, unit } from './pbt.fixture';

const RUNS = runs(300);

const anchors = fc.integer({ min: 1, max: 6 });
const pair = anchors.chain((n) => fc.tuple(rgbaArray(n), rgbaArray(n)));
const space = fc.constantFrom<ColorSpace>('rgb', 'oklab', 'oklch');

const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

describe('the default color interpolator, property', () => {
  it('answers `from` at 0 and `to` at 1 exactly in rgb, and finite colors in 0..1 between in any space', () => {
    fc.assert(fc.property(pair, space, unit, ([from, to], s, u) => {
      const interp = resolveInterpolator({ interpolation: s });
      if (s === 'rgb') {
        expect(interp(from, to, 0)).toEqual(from);
        expect(interp(from, to, 1)).toEqual(to);
      }
      const mid = interp(from, to, u);
      expect(mid).toHaveLength(from.length);
      for (const c of mid) {
        expect(Number.isFinite(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(-1e-9);
        expect(c).toBeLessThanOrEqual(1 + 1e-9);
      }
    }), RUNS);
  });
});

describe('the default color interpolator, shrunk', () => {
  it('lands on a `to` channel far below its `from` at 1', () => {
    expect(resolveInterpolator({})([0, 0, 0, 1], [0, 0, 0, 5e-324], 1)).toEqual([0, 0, 0, 5e-324]);
  });
});

describe('rainbowVertexColors and solidVertexColors, property', () => {
  it('give n anchors of colors in 0..1', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 40 }), unit, unit, unit, (n, s, l, a) => {
      for (const out of [rainbowVertexColors(n, { saturation: s, lightness: l, alpha: a }), solidVertexColors(n, s, l, a, a)]) {
        expect(out).toHaveLength(4 * n);
        for (const c of out) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(1);
        }
      }
    }), RUNS);
  });
});

/** The override a cycle installs. */
function cycleOf(opts: { msPerCycle: number; direction?: 1 | -1; interpolation?: ColorSpace }): ColorOverrideFn {
  const h = clocked();
  cycleVertexColors(h.animator, { id: 'a', channel: 'fill', easing: 'linear', ...opts });
  return h.animator.colorOverrides.get('a', 'fill') as ColorOverrideFn;
}

const rotated = (base: readonly number[], k: number): number[] => {
  const n = base.length / 4;
  return Array.from({ length: base.length }, (_, i) => base[(((Math.floor(i / 4) + k) % n + n) % n) * 4 + (i % 4)]!);
};

describe('cycleVertexColors, property', () => {
  it('shows its base at the start of every cycle, and the base turned k anchors k nths of the way round', () => {
    const t = tally();
    fc.assert(fc.property(anchors.chain((n) => rgbaArray(n)), fc.integer({ min: 1, max: 5000 }), fc.integer({ min: -50, max: 50 }), fc.integer({ min: 0, max: 5 }),
      (base, ms, laps, k) => {
        const n = base.length / 4;
        const f = cycleOf({ msPerCycle: ms });
        expect(f(base, 0)).toEqual(base);
        expect(f(base, laps * ms)).toEqual(base);
        const at = f(base, ((laps * n + k) * ms) / n);
        rotated(base, k).forEach((c, i) => expect(at[i]).toBeCloseTo(c, 6));
        if (n > 1 && k % n !== 0) t.count('turned');
      }), RUNS);
    t.atLeast('turned', 50);
  });

  it('turns the other way under direction -1 as time run back', () => {
    fc.assert(fc.property(anchors.chain((n) => rgbaArray(n)), fc.integer({ min: 1, max: 5000 }), fc.integer({ min: -20_000, max: 20_000 }), (base, ms, tMs) => {
      const back = cycleOf({ msPerCycle: ms, direction: -1 })(base, tMs);
      const fwd = cycleOf({ msPerCycle: ms })(base, -tMs);
      fwd.forEach((c, i) => expect(back[i]).toBeCloseTo(c, 9));
    }), RUNS);
  });

  it('answers finite colors in 0..1, as long as its base, at any time and in any space', () => {
    fc.assert(fc.property(anchors.chain((n) => rgbaArray(n)), fc.integer({ min: 1, max: 5000 }), fc.double({ min: -1e9, max: 1e9, noNaN: true }), space,
      (base, ms, tMs, s) => {
        const out = cycleOf({ msPerCycle: ms, interpolation: s })(base, tMs);
        expect(out).toHaveLength(base.length);
        for (const c of out) {
          expect(Number.isFinite(c)).toBe(true);
          expect(c).toBeGreaterThanOrEqual(-1e-9);
          expect(c).toBeLessThanOrEqual(1 + 1e-9);
        }
      }), RUNS);
  });
});

describe('staggerVertexColors, property', () => {
  it('moves each anchor on its own clock from the origin out, and lets go at the end', () => {
    const t = tally();
    fc.assert(fc.property(pair, fc.integer({ min: 1, max: 300 }), fc.integer({ min: 0, max: 200 }), fc.oneof(fc.constantFrom<'first' | 'last'>('first', 'last'), fc.integer({ min: -2, max: 8 })),
      fc.integer({ min: 1, max: 60 }),
      ([from, to], anchorMs, delay, origin, step) => {
        const h = clocked();
        const n = from.length / 4;
        const o = origin === 'first' ? 0 : origin === 'last' ? n - 1 : Math.max(0, Math.min(n - 1, origin));
        h.at(0);
        let done = 0;
        staggerVertexColors(h.animator, { id: 'a', channel: 'fill', from, to, anchorMs, perAnchorDelay: delay, origin, onDone: () => { done++; } });
        const total = Math.max(o, n - 1 - o) * delay + anchorMs;
        for (let now = step; now < total; now += step) {
          h.at(now);
          const got = h.animator.colorOverrides.get('a', 'fill') as readonly number[];
          for (let i = 0; i < from.length; i++) {
            const u = Math.max(0, Math.min(1, (now - Math.abs(Math.floor(i / 4) - o) * delay) / anchorMs));
            expect(got[i]).toBeCloseTo(lerp(from[i]!, to[i]!, u), 6);
          }
          t.count('frame');
        }
        h.at(total);
        expect(done).toBe(1);
        expect(h.animator.colorOverrides.get('a', 'fill')).toBeUndefined();
      }), RUNS);
    t.atLeast('frame', 100);
  });
});
