/** A pose fitted to its text holds it as laid out: wrapping at the fitted width breaks no line, and a second fit changes nothing. */
import { beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { fitTextPose } from './fitTextPose';
import { layoutTextPose } from './layout/textPoseLayout';
import type { TextPose } from './pose';
import { mixedText, registerPropertyFont, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;

beforeAll(registerPropertyFont);

const pose = fc.record({
  text: mixedText(14),
  fontSize: fc.constantFrom(13, 32, 47.5),
  letterSpacing: fc.constantFrom(0, 0, 1.7, -0.6),
  padding: fc.constantFrom(0, 3.25),
  align: fc.constantFrom('left' as const, 'center' as const, 'right' as const),
}).map(({ text, fontSize, letterSpacing, padding, align }) => ({
  padding,
  pose: { x: 5, y: 7, width: 100, height: 10, text, style: { fontFamily: 'inter', fontSize, letterSpacing, align } } as TextPose,
}));

describe('fitTextPose, property', () => {
  it('fits both axes so that wrapping at the fitted width breaks no line', () => {
    const t = tally();
    fc.assert(fc.property(pose, ({ pose: p, padding }) => {
      const fitted = fitTextPose(p, { axis: 'both', padding });
      const unwrapped = layoutTextPose({ ...p, style: { ...p.style, wrap: false } }).laid.lines;
      const inner = { ...fitted, width: fitted.width - padding * 2, style: { ...p.style, wrap: true } };
      const wrapped = layoutTextPose(inner).laid.lines;
      expect(wrapped.length, JSON.stringify(p.text)).toBe(unwrapped.length);
      expect(fitTextPose(fitted, { axis: 'both', padding })).toEqual(fitted);
      if (fitted.width > padding * 2 + 40) t.count('wide');
    }), runs(RUNS));
    t.atLeast('wide', 50);
  }, timeoutFor(RUNS, 20));

  it('fits a line whose last cluster is narrower than its negative tracking (shrunk counterexample)', () => {
    // A mark after a zero-width space is a cluster of its own, and its tracking pulls the line's end back.
    const p: TextPose = {
      x: 5, y: 7, width: 100, height: 10, text: '\u{1f1fa}\u{1f1f8}\u{1f1eb}\u{1f1f7}\u200b\u0301',
      style: { fontFamily: 'inter', fontSize: 13, letterSpacing: -0.6, align: 'left' },
    };
    const fitted = fitTextPose(p, { axis: 'both' });
    expect(layoutTextPose({ ...fitted, style: { ...p.style, wrap: true } }).laid.lines).toHaveLength(1);
  });
});
