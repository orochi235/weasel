import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseColor } from './color';
import { linearSrgbToOklab, oklabToOklch, srgbToLinear } from './colorSpaces';
import { hslToSrgb } from './hsl';
import {
  colorLiteralToCss, colorLiteralToHex, cssColorLiteral, cssColorNotation, hexToColorLiteral, resolvePaletteColor,
  resolvePaletteColors, type ColorLiteral, type ColorSource, type Palette, type PaletteEntry,
} from './palette';
import { hexColor, maxDiff, rgb, runs, tally, timeoutFor, unit } from './pbt.fixture';

const RUNS = runs(300);
const BYTE = 0.5 / 255 + 1e-9;

describe('palette literals, property', () => {
  it('writes back the hex hexToColorLiteral reads, dropping an opaque alpha', () => {
    fc.assert(fc.property(hexColor, ({ text, bytes }) => {
      const lit = hexToColorLiteral(text)!;
      const want = text.toLowerCase().slice(0, bytes[3] === 255 ? 7 : 9);
      expect(colorLiteralToHex(lit)).toBe(want);
      expect(colorLiteralToCss(lit)).toBe(want);
    }), RUNS);
  });

  it('carries any color parseColor reads through a literal and back to CSS, to the byte', () => {
    const css = fc.oneof(
      hexColor.map((h) => h.text),
      fc.tuple(rgb, unit).map(([[r, g, b], a]) => `color(srgb ${r} ${g} ${b} / ${a})`),
      fc.tuple(fc.double({ min: 0, max: 360, noNaN: true }), unit, unit).map(([h, s, l]) => `hsl(${h} ${s * 100}% ${l * 100}%)`),
    );
    fc.assert(fc.property(css, (text) => {
      const back = colorLiteralToCss(cssColorLiteral(text))!;
      const [a, b] = [parseColor(text), parseColor(back)];
      expect(maxDiff(a.slice(0, 3), b.slice(0, 3)), `${text} → ${back}`).toBeLessThanOrEqual(BYTE);
      expect(Math.abs(a[3] - b[3])).toBeLessThanOrEqual(a[3] < 1 ? BYTE : 0);
    }), RUNS);
  });

  it('writes notation parseColor reads as the color the coordinates name', () => {
    const t = tally();
    fc.assert(fc.property(rgb, fc.constantFrom('srgb', 'srgb-linear', 'hsl', 'oklab', 'oklch'), fc.option(unit, { nil: undefined }), ([r, g, b], space, alpha) => {
      let coords: number[];
      if (space === 'srgb') coords = [r, g, b];
      else if (space === 'srgb-linear') coords = [r, g, b].map(srgbToLinear);
      else if (space === 'hsl') coords = [r * 360, g * 100, b * 100];
      else {
        const lab = linearSrgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
        coords = space === 'oklab' ? lab : (([L, C, h]) => [L, C, (h * 180) / Math.PI])(oklabToOklch(...lab));
      }
      const text = cssColorNotation(space, coords, alpha)!;
      t.count(space);
      const got = parseColor(text);
      const want = space === 'hsl' ? hslToSrgb(r * 360, g, b) : [r, g, b];
      expect(maxDiff(got.slice(0, 3), want), text).toBeLessThan(1e-5);
      expect(got[3]).toBe(alpha === undefined || alpha >= 1 ? 1 : alpha);
    }), RUNS);
    for (const s of ['srgb', 'srgb-linear', 'hsl', 'oklab', 'oklch']) t.atLeast(s, 1);
  });
});

/** A palette source as plain data, so the model and the palette are built from one value. */
type Src = { lit: number } | { ref: string; index?: number } | { fn: Src };
type Entry = { name: string; color: Src } | { name: string; colors: Src[] };

const NAMES = ['a', 'b', 'c', 'd', 'x'];
const src: fc.Arbitrary<Src> = fc.letrec<{ src: Src }>((tie) => ({
  src: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.nat(9).map((lit) => ({ lit })),
    fc.record({ ref: fc.constantFrom(...NAMES), index: fc.option(fc.nat(3), { nil: undefined }) }, { requiredKeys: ['ref'] })
      .map((r) => (r.index === undefined ? { ref: r.ref } : r)),
    tie('src').map((inner) => ({ fn: inner })),
  ),
})).src;
const entry: fc.Arbitrary<Entry> = fc.oneof(
  fc.record({ name: fc.constantFrom(...NAMES.slice(0, 4)), color: src }),
  fc.record({ name: fc.constantFrom(...NAMES.slice(0, 4)), colors: fc.array(src, { maxLength: 3 }) }),
);

const lits: ColorLiteral[] = Array.from({ length: 10 }, (_, i) => ({ space: 'srgb', coords: [i / 10, 0, 0] }));
const externalLit: ColorLiteral = { space: 'srgb', coords: [0, 0, 1] };

function toSource(s: Src): ColorSource {
  if ('lit' in s) return lits[s.lit]!;
  if ('fn' in s) return (ctx) => ctx.resolve(toSource(s.fn));
  return s;
}
function toPalette(entries: readonly Entry[]): Palette {
  return {
    entries: entries.map((e): PaletteEntry => ('color' in e
      ? { name: e.name, color: toSource(e.color) }
      : { name: e.name, colors: () => e.colors.map(toSource) })),
  };
}

/** What the palette should resolve `s` to, written out plainly. Refs to `x` go to the external lookup. */
function model(entries: readonly Entry[], s: Src, visiting: ReadonlySet<string>): ColorLiteral | null {
  if ('lit' in s) return lits[s.lit]!;
  if ('fn' in s) return model(entries, s.fn, visiting);
  const index = s.index ?? 0;
  const key = `${s.ref}#${index}`;
  if (visiting.has(key)) return null;
  const next = new Set(visiting).add(key);
  const e = entries.find((x) => x.name === s.ref);
  if (!e) return s.ref === 'x' && index === 0 ? externalLit : null;
  if ('color' in e) return index === 0 ? model(entries, e.color, next) : null;
  const item = e.colors[index];
  return item === undefined ? null : model(entries, item, next);
}

describe('resolvePaletteColor, property', () => {
  const external = (r: { ref: string; index?: number }) => (r.ref === 'x' && (r.index ?? 0) === 0 ? externalLit : null);

  it('resolves refs, sequences, functions, and cycles as the plain model does, and always ends', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(entry, { maxLength: 6 }), src, (entries, s) => {
      const want = model(entries, s, new Set());
      t.count(want === null ? 'null' : 'color');
      expect(resolvePaletteColor(toPalette(entries), toSource(s), external)).toBe(want);
    }), { numRuns: RUNS.numRuns * 3 });
    t.atLeast('null', 1);
    t.atLeast('color', 1);
  }, timeoutFor(300, 0.3));

  it('lists an entry\'s colors as resolving each ref to it would', () => {
    fc.assert(fc.property(fc.array(entry, { maxLength: 6 }), fc.constantFrom(...NAMES), (entries, name) => {
      const palette = toPalette(entries);
      const listed = [...resolvePaletteColors(palette, name, external)];
      listed.forEach((c, index) => expect(c).toBe(resolvePaletteColor(palette, { ref: name, index }, external)));
      const e = entries.find((x) => x.name === name);
      expect(listed.length).toBe(e === undefined ? 0 : 'color' in e ? 1 : e.colors.length);
    }), RUNS);
  });
});
