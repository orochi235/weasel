/**
 * Property tests of measuring: `envPx` reads a px length however CSS or JavaScript spells its number;
 * `measureButton` holds its box to the constraints and lays its parts out in order, a gap apart, centered, with the
 * label giving up width first.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buttonParts, measureButton, type ButtonFace } from './button';
import { envPx, type MeasureEnv } from './measure';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

const envOf = (tokens: Record<string, string>, perChar = 6): MeasureEnv => ({
  token: (n) => tokens[n],
  text: (t) => ({ width: [...t].length * perChar, ascent: 10, descent: 2 }),
});

describe('envPx', () => {
  it('reads a px length written as JavaScript writes the number, and in any spelling CSS takes', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.oneof(fc.double({ noNaN: true, noDefaultInfinity: true }), fc.integer(), fc.constantFrom(1e21, 1e-7, 5e-324, -0, 0.5)),
      fc.constantFrom('js', 'plus', 'upper', 'exp'),
      (n, spelling) => {
        let text = `${String(n)}px`;
        if (spelling === 'plus' && n >= 0) text = `+${String(n)}px`;
        if (spelling === 'upper') text = `${String(n)}PX`;
        if (spelling === 'exp') text = `${n.toExponential()}px`;
        const got = envPx(envOf({ '--a': text }), '--a');
        expect(got === Number(text.slice(0, -2)) || (got === 0 && n === 0)).toBe(true);
        t.count(String(n).includes('e') || spelling === 'exp' ? 'exponent' : 'plain');
      },
    ), runs(RUNS));
    t.atLeast('exponent', RUNS / 4);
  }, timeoutFor(RUNS, 1));

  it('takes the fallback for anything that is not a px length', () => {
    fc.assert(fc.property(
      fc.oneof(fc.constantFrom('1em', '12', 'px', '', '1e', '1epx', '--', 'calc(1px)', '1 px', '.px', '1.px', 'e5px', 'NaNpx', 'Infinitypx', '12px 4px'), fc.string({ maxLength: 4 }).map((s) => `${s}rem`)),
      (text) => {
        expect(envPx(envOf({ '--a': text }), '--a', 7)).toBe(7);
      },
    ), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

const icon = fc.option(fc.constant('i'), { nil: undefined });
const face: fc.Arbitrary<ButtonFace> = fc.record({
  label: fc.option(fc.constantFrom('', 'Go', 'Save changes', 'A much longer label than fits', '😀 ok'), { nil: undefined }),
  size: fc.option(fc.constantFrom('sm' as const, 'md' as const), { nil: undefined }),
  iconOnly: fc.option(fc.boolean(), { nil: undefined }),
  icon, leadingIcon: icon, trailingIcon: icon,
  loading: fc.option(fc.boolean(), { nil: undefined }),
}, { requiredKeys: [] });

const px = (lo: number, hi: number) => fc.integer({ min: lo, max: hi }).map((n) => `${n}px`);
const tokens = fc.record({
  '--wzl-control-h': px(16, 40), '--wzl-control-h-sm': px(12, 30),
  '--wzl-space-3': px(0, 10), '--wzl-space-4': px(0, 12), '--wzl-space-6': px(0, 16),
  '--wzl-font-size': px(8, 18), '--wzl-font-size-sm': px(8, 16),
});
const bound = fc.oneof(fc.constant(0), fc.integer({ min: 0, max: 300 }), fc.constant(Infinity));
const constraints = fc.tuple(bound, bound, bound, bound).map(([a, b, c, d]) => ({
  minWidth: Math.min(a, b), maxWidth: Math.max(a, b), minHeight: Math.min(c, d), maxHeight: Math.max(c, d),
})).filter((c) => Number.isFinite(c.minWidth) && Number.isFinite(c.minHeight));

describe('measureButton', () => {
  it('holds its box to the constraints, lays parts out in order a gap apart and centered, the label giving up width first', () => {
    const t = tally();
    fc.assert(fc.property(face, tokens, constraints, fc.constantFrom(0, 3, 6, 11), (f, tk, c, perChar) => {
      const env = envOf(tk, perChar);
      const m = measureButton(f, c, env);
      const metrics = m.layout.metrics;
      expect(m.width).toBeGreaterThanOrEqual(c.minWidth);
      expect(m.width).toBeLessThanOrEqual(c.maxWidth);
      expect(m.height).toBeGreaterThanOrEqual(c.minHeight);
      expect(m.height).toBeLessThanOrEqual(c.maxHeight);
      expect(m.layout.parts.map((p) => p.part)).toEqual(buttonParts(f));
      const rects = m.layout.parts.map((p) => p.rect);
      for (let i = 1; i < rects.length; i++) expect(rects[i]!.x).toBeCloseTo(rects[i - 1]!.x + rects[i - 1]!.width + metrics.gap, 9);
      for (const r of rects) {
        expect(r.width).toBeGreaterThanOrEqual(0);
        expect(r.y + r.height / 2).toBeCloseTo(m.height / 2, 9);
      }
      if (rects.length > 0) {
        const left = rects[0]!.x;
        const right = m.width - (rects.at(-1)!.x + rects.at(-1)!.width);
        expect(left).toBeCloseTo(right, 9);
      }
      const label = m.layout.parts.find((p) => p.part === 'label');
      if (label) {
        const full = env.text(f.label ?? '', metrics.font).width;
        const others = rects.reduce((a, r) => a + r.width, 0) - label.rect.width;
        const room = m.width - 2 * metrics.padX - others - metrics.gap * Math.max(0, rects.length - 1);
        expect(label.rect.width).toBeCloseTo(Math.max(0, Math.min(full, room)), 9);
        t.count(label.rect.width < full ? 'squeezed' : 'whole');
      }
      expect(Number.isFinite(m.baseline)).toBe(true);
    }), runs(RUNS));
    t.atLeast('squeezed', RUNS / 20);
    t.atLeast('whole', RUNS / 10);
  }, timeoutFor(RUNS, 1));
});

describe('shrunk counterexamples', () => {
  it('envPx reads a length JavaScript writes with an exponent, and CSS spellings of its number', () => {
    const at = (text: string) => envPx(envOf({ '--a': text }), '--a');
    expect(at('1e+21px')).toBe(1e21);
    expect(at('1e-7px')).toBe(1e-7);
    expect(at('+4px')).toBe(4);
    expect(at('2PX')).toBe(2);
    expect(at('0.0')).toBe(0);
  });
});
