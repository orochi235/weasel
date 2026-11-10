import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { normalizeHex, parseColor, parseColorToRgba255, rgbaToHex, tryNormalizeHex } from './color';
import { linearToSrgb, linearSrgbToOklab, oklabToLinearSrgb, srgbToLinear } from './colorSpaces';
import { hslToSrgb } from './hsl';
import { byteHex, parseHexBytes } from './hex';
import { byte, hexColor, maxDiff, rgba, runs, tally, timeoutFor, unit } from './pbt.fixture';

const RUNS = runs(300);

type Rgba = [number, number, number, number];

/** A CSS color string the parser accepts, with the 0..1 channels it stands for and how close they must come. */
interface Form { text: string; want: Rgba; tol: number }

const alphaTail = fc.option(fc.tuple(unit, fc.boolean()), { nil: undefined });

const rgbForm: fc.Arbitrary<Form> = fc
  .tuple(byte, byte, byte, alphaTail, fc.constantFrom('legacy', 'modern'), fc.boolean())
  .map(([r, g, b, alpha, syntax, percent]) => {
    const ch = (v: number): string => (percent ? `${(v / 255) * 100}%` : `${v}`);
    const a = alpha === undefined ? undefined : alpha[1] ? `${alpha[0] * 100}%` : `${alpha[0]}`;
    const body = syntax === 'legacy'
      ? [ch(r), ch(g), ch(b), ...(a === undefined ? [] : [a])].join(', ')
      : `${ch(r)} ${ch(g)} ${ch(b)}${a === undefined ? '' : ` / ${a}`}`;
    const fn = syntax === 'legacy' && a !== undefined ? 'rgba' : 'rgb';
    return { text: `${fn}(${body})`, want: [r / 255, g / 255, b / 255, alpha?.[0] ?? 1], tol: 1e-12 };
  });

const hueUnit = fc.constantFrom('', 'deg', 'grad', 'rad', 'turn');
const hueText = (deg: number, u: string): string => {
  const n = u === 'grad' ? deg / 0.9 : u === 'rad' ? (deg * Math.PI) / 180 : u === 'turn' ? deg / 360 : deg;
  return `${n}${u}`;
};

const hslForm: fc.Arbitrary<Form> = fc
  .tuple(fc.double({ min: -720, max: 720, noNaN: true }), hueUnit, unit, unit, alphaTail, fc.boolean())
  .map(([h, u, s, l, alpha, unitless]) => {
    const pct = (v: number): string => `${v * 100}${unitless ? '' : '%'}`;
    const a = alpha === undefined ? '' : ` / ${alpha[0]}`;
    const wrapped = ((h % 360) + 360) % 360;
    const [r, g, b] = hslToSrgb(wrapped, s, l);
    return { text: `hsl(${hueText(h, u)} ${pct(s)} ${pct(l)}${a})`, want: [r, g, b, alpha?.[0] ?? 1], tol: 1e-9 };
  });

const colorFnForm: fc.Arbitrary<Form> = fc
  .tuple(unit, unit, unit, fc.constantFrom('srgb', 'srgb-linear'), alphaTail)
  .map(([r, g, b, space, alpha]) => {
    const a = alpha === undefined ? '' : ` / ${alpha[0]}`;
    const enc = (c: number): number => (space === 'srgb' ? c : linearToSrgb(c));
    return { text: `color(${space} ${r} ${g} ${b}${a})`, want: [enc(r), enc(g), enc(b), alpha?.[0] ?? 1], tol: 1e-12 };
  });

/** An in-gamut color written as `oklab()` or `oklch()`: its OKLab coordinates, measured from an sRGB color. */
const okForm: fc.Arbitrary<Form> = fc
  .tuple(unit, unit, unit, fc.boolean(), fc.boolean())
  .map(([r, g, b, polar, percentL]) => {
    const [L, A, B] = linearSrgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
    const l = percentL ? `${L * 100}%` : `${L}`;
    const body = polar
      ? `${l} ${Math.hypot(A, B)} ${(Math.atan2(B, A) * 180) / Math.PI}`
      : `${l} ${A} ${B}`;
    return { text: `${polar ? 'oklch' : 'oklab'}(${body})`, want: [r, g, b, 1], tol: 1e-5 };
  });

const hexForm: fc.Arbitrary<Form> = hexColor.map(({ text, bytes }) => ({
  text, want: bytes.map((v) => v / 255) as Rgba, tol: 0,
}));

const form = fc.oneof(rgbForm, hslForm, colorFnForm, okForm, hexForm);

describe('parseColor, property', () => {
  it('reads every form it documents as the color it names', () => {
    fc.assert(fc.property(form, ({ text, want, tol }) => {
      expect(maxDiff(parseColor(text), want), text).toBeLessThanOrEqual(tol);
    }), { numRuns: RUNS.numRuns * 3 });
  }, timeoutFor(300, 0.3));

  it('ignores case and surrounding whitespace', () => {
    const pad = fc.constantFrom('', ' ', '\t', '\n ');
    fc.assert(fc.property(form, pad, pad, ({ text }, l, r) => {
      expect(parseColor(`${l}${text.toUpperCase()}${r}`)).toEqual(parseColor(text));
    }), RUNS);
  });

  it('reads the hex it writes back to the same bytes', () => {
    fc.assert(fc.property(hexColor, ({ text, bytes }) => {
      expect(parseColorToRgba255(text)).toEqual(bytes);
      const written = rgbaToHex(parseColor(text));
      expect(parseColorToRgba255(written)).toEqual(bytes);
      expect(written).toBe(normalizeHex(text, bytes[3] === 255 ? 'rgb' : 'rgba'));
    }), RUNS);
  });

  it('writes a float color as the hex nearest it', () => {
    fc.assert(fc.property(rgba, (c) => {
      const back = parseColor(rgbaToHex(c));
      const want = c[3] >= 1 ? [...c.slice(0, 3), 1] : c;
      expect(maxDiff(back, want)).toBeLessThanOrEqual(0.5 / 255 + 1e-12);
    }), RUNS);
  });

  it('never throws but to refuse, and never answers a channel outside 0..1, whatever the text', () => {
    const t = tally();
    const piece = fc.constantFrom(
      'rgb(', 'rgba(', 'hsl(', 'hsla(', 'color(', 'srgb ', 'srgb-linear ', 'oklab(', 'oklch(', '#', ')', ',', '/',
      ' ', '%', 'deg', 'rad', 'grad', 'turn', 'e', '-', '+', '.', '0', '1', '5', '9', '255', '1e400', 'f', 'a',
      'none', 'red', 'nan', 'infinity', '0x1', '\t',
    );
    fc.assert(fc.property(fc.array(piece, { maxLength: 14 }), (parts) => {
      const text = parts.join('');
      let got: readonly number[];
      try {
        got = parseColor(text);
      } catch (e) {
        expect((e as Error).message).toMatch(/^parseColor:/);
        t.count('refused');
        return;
      }
      t.count('read');
      expect(got).toHaveLength(4);
      for (const v of got) expect(v >= 0 && v <= 1, `${text} → ${got}`).toBe(true);
    }), { numRuns: RUNS.numRuns * 10 });
    t.atLeast('refused', 1);
    t.atLeast('read', 1);
  }, timeoutFor(300, 1));

  it('reads an out-of-gamut oklab color as a color in gamut', () => {
    fc.assert(fc.property(
      fc.double({ min: -0.5, max: 1.5, noNaN: true }),
      fc.double({ min: -1, max: 1, noNaN: true }),
      fc.double({ min: -1, max: 1, noNaN: true }),
      (L, A, B) => {
        const got = parseColor(`oklab(${L} ${A} ${B})`);
        for (const v of got) expect(v >= 0 && v <= 1).toBe(true);
        const lin = oklabToLinearSrgb(Math.min(1, Math.max(0, L)), A, B);
        if (lin.every((c) => c >= 0 && c <= 1)) expect(maxDiff(got.slice(0, 3), lin.map(linearToSrgb))).toBeLessThan(1e-9);
      },
    ), RUNS);
  });
});

describe('normalizeHex, property', () => {
  it('is idempotent, and takes a hex with or without its #', () => {
    fc.assert(fc.property(hexColor, fc.constantFrom(undefined, 'rgb', 'rgba'), ({ text }, f) => {
      const once = normalizeHex(text, f);
      expect(normalizeHex(once, f)).toBe(once);
      expect(tryNormalizeHex(text.slice(1), f)).toBe(once);
      expect(once).toMatch(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/);
    }), RUNS);
  });

  it('reads #rgb and #rgba as each digit doubled', () => {
    const digit = fc.constantFrom(...'0123456789abcdefABCDEF'.split(''));
    fc.assert(fc.property(fc.array(digit, { minLength: 3, maxLength: 4 }), (ds) => {
      expect(normalizeHex(`#${ds.join('')}`)).toBe(`#${ds.map((d) => d + d).join('').toLowerCase()}`);
    }), RUNS);
  });
});

describe('byteHex, property', () => {
  it('writes any number as two hex digits, rounded and clamped, NaN as 0', () => {
    fc.assert(fc.property(fc.oneof(fc.double(), fc.integer({ min: -10, max: 300 })), (v) => {
      const hex = byteHex(v);
      expect(hex).toMatch(/^[0-9a-f]{2}$/);
      const want = Number.isNaN(v) ? 0 : Math.max(0, Math.min(255, Math.round(v)));
      expect(parseHexBytes(`#${hex}${hex}${hex}`)![0]).toBe(want);
    }), RUNS);
  });
});
