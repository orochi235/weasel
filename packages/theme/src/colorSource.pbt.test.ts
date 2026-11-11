/**
 * Property tests of color lists and theme color refs over the built-in theme: a ramp list wraps and reads the
 * resolved theme, a ramp ref by index names the same color as the step's own token, a token ref is written as
 * its custom property exactly when it resolves to a color, and no name, those of `Object.prototype` included,
 * makes either throw anything but the documented error.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { colorAt, colorCount, colorCssAt, rampSteps } from './colorList';
import { colorSourceCss, colorSourceLiteral } from './colorSource';
import { runs, tally } from './pbt.fixture';
import { resolveTheme } from './resolveTheme';
import { weaselTheme } from './theme';

const RUNS = 300;

const MODES = ['dark', 'light'] as const;
const ctxFor = (mode: string) => ({ theme: weaselTheme, resolved: resolveTheme(weaselTheme, { mode }) });
const RAMPS = Object.keys(weaselTheme.ramps ?? {});
const TOKENS = Object.keys(resolveTheme(weaselTheme)).map((p) => p.slice('--wzl-'.length));
const index = fc.oneof(fc.integer({ min: -50, max: 50 }), fc.double({ min: -1e9, max: 1e9, noNaN: true }));
const PROTO = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'];

describe('ramp color lists', () => {
  it('wrap around, reading the resolved theme at the step they land on', () => {
    fc.assert(fc.property(fc.constantFrom(...RAMPS), index, fc.constantFrom(...MODES), (ramp, i, mode) => {
      const ctx = ctxFor(mode);
      const steps = rampSteps(weaselTheme, ramp);
      const n = colorCount({ ramp }, ctx)!;
      expect(n).toBe(steps.length);
      const step = steps[((Math.trunc(i) % n) + n) % n]!;
      const property = `--wzl-${ramp}-${step}`;
      expect(colorAt({ ramp }, i, ctx)).toBe((ctx.resolved as Record<string, string>)[property]);
      if (Number.isInteger(i)) expect(colorAt({ ramp }, i + n, ctx)).toBe(colorAt({ ramp }, i, ctx));
      expect(colorCssAt({ ramp }, i, ctx)).toBe(`var(${property})`);
    }), runs(RUNS));
  });

  it('refuses a ramp the theme does not have, whatever it is named, with an error saying so', () => {
    fc.assert(fc.property(fc.oneof(fc.constantFrom(...PROTO), fc.string({ maxLength: 6 })), fc.integer(), (ramp, i) => {
      fc.pre(!RAMPS.includes(ramp));
      expect(() => colorCssAt({ ramp }, i)).toThrow(`has no ramp "${ramp}"`);
      expect(() => colorCount({ ramp })).toThrow(`has no ramp "${ramp}"`);
    }), runs(RUNS));
  });
});

describe('theme color refs', () => {
  it('a ramp ref by index names the color of that step\'s own token, and nothing past the last step', () => {
    const t = tally();
    fc.assert(fc.property(fc.constantFrom(...RAMPS), fc.integer({ min: 0, max: 15 }), fc.constantFrom(...MODES), (ramp, i, mode) => {
      const ctx = ctxFor(mode);
      const steps = rampSteps(weaselTheme, ramp);
      const got = colorSourceLiteral({ ref: ramp, index: i }, ctx);
      if (i >= steps.length) {
        t.count('past');
        expect(got).toBeNull();
        return;
      }
      t.count('step');
      expect(got).toEqual(colorSourceLiteral({ ref: `${ramp}-${steps[i]}` }, ctx));
    }), runs(RUNS));
    t.atLeast('step', 50);
    t.atLeast('past', 20);
  });

  it('a token ref is written as its custom property exactly when it resolves to a color', () => {
    const t = tally();
    fc.assert(fc.property(fc.oneof({ weight: 4, arbitrary: fc.constantFrom(...TOKENS) }, fc.constantFrom(...PROTO, 'nope', '--wzl-fg', '--x')), fc.constantFrom(...MODES), (name, mode) => {
      const ctx = ctxFor(mode);
      const literal = colorSourceLiteral({ ref: name }, ctx);
      const css = colorSourceCss({ ref: name }, ctx);
      t.count(literal ? 'color' : 'not a color');
      if (name.startsWith('--')) {
        expect(css).toBe(`var(${name})`);
        return;
      }
      expect(css).toBe(literal ? `var(--wzl-${name})` : null);
    }), runs(RUNS));
    t.atLeast('color', 50);
    t.atLeast('not a color', 30);
  });

  it('a ref with any name and index resolves or answers null, never throws', () => {
    fc.assert(fc.property(fc.oneof(fc.constantFrom(...PROTO, ...RAMPS, 'tint'), fc.string({ maxLength: 6 })), fc.option(index, { nil: undefined }), (ref, i) => {
      const source = i === undefined ? { ref } : { ref, index: i };
      colorSourceLiteral(source);
      colorSourceCss(source);
    }), runs(RUNS));
  });
});
