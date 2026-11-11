/**
 * Property tests of CPU dithering: every method answers one ink bit a pixel and leaves its inputs alone; a uniform
 * gray dithers to the density it should (exactly for the ordered matrix over whole tiles, within the error lost at
 * the edges for Floyd–Steinberg); Floyd–Steinberg conserves the total intensity but for what leaves the image; and a
 * protected pixel quantizes at plain threshold, neither taking error in nor sending it out.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ditherPixels } from './ditherPixels';
import { toGray } from './gray';
import { maskToRgba } from './maskToRgba';
import { BAYER_4X4 } from './shared';
import { grayImage } from './testing/grayImage';
import type { RgbaImage } from './types';
import { METHODS, byte, image, protect, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;

const threshold = fc.oneof(byte, fc.double({ min: 0, max: 256, noNaN: true }));
const background = fc.option(fc.tuple(byte, byte, byte), { nil: undefined });
const sum = (a: ArrayLike<number>) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]!; return s; };

describe('ditherPixels', () => {
  it('answers one ink bit a pixel for every method, and changes neither the image nor the protect mask', () => {
    const t = tally();
    const input = image().chain((img) => fc.record({ img: fc.constant(img), protect: protect(img.width * img.height) }));
    fc.assert(fc.property(input, fc.constantFrom(...METHODS), threshold, background, ({ img, protect: p }, method, th, bg) => {
      const data = Uint8ClampedArray.from(img.data);
      const guard = p && Uint8Array.from(p);
      const mask = ditherPixels(img, { method, threshold: th, ...(bg ? { background: bg } : {}), ...(p ? { protect: p } : {}) });
      expect(mask).toHaveLength(img.width * img.height);
      for (const v of mask) expect(v === 0 || v === 1).toBe(true);
      expect(img.data).toEqual(data);
      if (p) expect(p).toEqual(guard);
      t.count(sum(mask) > 0 && sum(mask) < mask.length ? 'mixed' : 'flat');
    }), runs(RUNS));
    t.atLeast('mixed', 50);
  }, timeoutFor(RUNS, 2));

  it('refuses a size that is not whole pixels, or data or a mask of the wrong length, with a RangeError', () => {
    const dim = fc.oneof(fc.integer({ min: 0, max: 6 }), fc.double(), fc.constantFrom(-1, 2.5, Number.NaN, Infinity));
    fc.assert(fc.property(dim, dim, fc.integer({ min: 0, max: 80 }), fc.option(fc.integer({ min: 0, max: 40 }), { nil: undefined }), (w, h, bytes, pn) => {
      const img = { width: w, height: h, data: new Uint8ClampedArray(bytes) };
      const ok = Number.isSafeInteger(w) && Number.isSafeInteger(h) && w >= 0 && h >= 0 && bytes === w * h * 4 && (pn === undefined || pn === w * h);
      const run = () => ditherPixels(img, { method: 'floyd-steinberg', ...(pn !== undefined ? { protect: new Uint8Array(pn) } : {}) });
      if (ok) expect(run).not.toThrow();
      else expect(run).toThrow(RangeError);
    }), runs(RUNS));
  });

  it('dithers a uniform gray to the density it should: all or nothing at threshold, the matrix count over whole tiles', () => {
    const t = tally();
    fc.assert(fc.property(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 6 }), byte, threshold, (tw, th4, g, th) => {
      const img = grayImage(tw * 4, th4 * 4, () => g);
      const gray = toGray(img)[0]!;
      expect(sum(ditherPixels(img, { threshold: th }))).toBe(gray < th ? img.width * img.height : 0);
      const perTile = BAYER_4X4.filter((m) => gray < (m + 0.5) * 16 + (th - 128)).length;
      expect(sum(ditherPixels(img, { method: 'bayer', threshold: th }))).toBe(perTile * tw * th4);
      t.count(perTile > 0 && perTile < 16 ? 'partial' : 'flat');
    }), runs(RUNS));
    t.atLeast('partial', 50);
  }, timeoutFor(RUNS, 2));

  it('conserves total intensity under Floyd–Steinberg, but for the error that leaves through the edges', () => {
    const t = tally();
    fc.assert(fc.property(image(24), fc.integer({ min: 64, max: 192 }), (img, th) => {
      const { width: w, height: h } = img;
      if (w < 2 || h < 2) return;
      t.count('image');
      const mask = ditherPixels(img, { method: 'floyd-steinberg', threshold: th });
      const out = (mask.length - sum(mask)) * 255;
      // A pixel's error is under 255 in size; the last row, and the first and last columns, are where it can leave.
      const edge = w + 2 * (h - 1);
      expect(Math.abs(out - sum(toGray(img)))).toBeLessThanOrEqual(255 * edge + 1e-3 * w * h);
    }), runs(RUNS));
    t.atLeast('image', 100);
  }, timeoutFor(RUNS, 2));

  it('dithers a uniform gray to its density under Floyd–Steinberg, within what the edges lose', () => {
    fc.assert(fc.property(fc.integer({ min: 8, max: 40 }), fc.integer({ min: 8, max: 40 }), byte, (w, h, g) => {
      const img = grayImage(w, h, () => g);
      const gray = toGray(img)[0]!;
      const ink = sum(ditherPixels(img, { method: 'floyd-steinberg' }));
      const want = (w * h * (255 - gray)) / 255;
      expect(Math.abs(ink - want)).toBeLessThanOrEqual(w + 2 * (h - 1));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));

  it('quantizes a protected pixel at plain threshold, and no error crosses its edge either way', () => {
    const t = tally();
    const input = image().filter((i) => i.width * i.height > 1).chain((img) => fc.record({
      img: fc.constant(img),
      p: protect(img.width * img.height).filter((p) => p !== undefined && sum(p) > 0),
      repaint: fc.array(byte, { minLength: img.width * img.height, maxLength: img.width * img.height }),
    }));
    fc.assert(fc.property(input, fc.constantFrom(...METHODS), fc.integer({ min: 1, max: 254 }), ({ img, p, repaint }, method, th) => {
      const protectMask = p!;
      const gray = toGray(img);
      const mask = ditherPixels(img, { method, threshold: th, protect: protectMask });
      for (let i = 0; i < mask.length; i++) if (protectMask[i]) expect(mask[i]).toBe(gray[i]! < th ? 1 : 0);
      // Repaint every protected pixel: nothing it sent could have reached another, so no other pixel changes.
      const data = Uint8ClampedArray.from(img.data);
      for (let i = 0; i < mask.length; i++) {
        if (!protectMask[i]) continue;
        data.set([repaint[i]!, repaint[i]!, repaint[i]!, 255], i * 4);
      }
      const other: RgbaImage = { width: img.width, height: img.height, data };
      const again = ditherPixels(other, { method, threshold: th, protect: protectMask });
      for (let i = 0; i < mask.length; i++) if (!protectMask[i]) expect(again[i]).toBe(mask[i]);
      t.count(method);
    }), runs(RUNS));
    for (const m of METHODS) t.atLeast(m, 25);
  }, timeoutFor(RUNS, 2));
});

describe('maskToRgba', () => {
  it('paints ink and blank alone, and dithers back to the same mask at threshold', () => {
    const color = fc.tuple(byte, byte, byte, byte);
    fc.assert(fc.property(fc.integer({ min: 0, max: 10 }), fc.integer({ min: 0, max: 10 }), fc.option(fc.tuple(color, color), { nil: undefined }), (w, h, colors) => fc.assert(
      fc.property(fc.array(fc.constantFrom(0, 1, 3), { minLength: w * h, maxLength: w * h }), (bits) => {
        const mask = Uint8Array.from(bits);
        const rgba = maskToRgba(mask, w, h, colors ? { ink: colors[0], blank: colors[1] } : {});
        expect(rgba).toHaveLength(w * h * 4);
        const [ink, blank] = colors ?? [[0, 0, 0, 255], [0, 0, 0, 0]];
        for (let i = 0; i < w * h; i++) expect([...rgba.subarray(i * 4, i * 4 + 4)]).toEqual(mask[i] ? ink : blank);
        if (!colors) expect(ditherPixels({ width: w, height: h, data: rgba })).toEqual(mask.map((v) => (v ? 1 : 0)));
      }),
      { numRuns: 3 },
    )), runs(RUNS));
  }, timeoutFor(RUNS, 3));
});

describe('toGray', () => {
  it('stays in 0..255, is the background where clear and the pixel where opaque', () => {
    fc.assert(fc.property(image(6), fc.tuple(byte, byte, byte), (img, bg) => {
      const gray = toGray(img, bg);
      const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
      for (let i = 0; i < gray.length; i++) {
        const v = gray[i]!;
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
        const [r, g, b, a] = img.data.subarray(i * 4, i * 4 + 4);
        if (a === 0) expect(v).toBeCloseTo(luma(...bg), 3);
        if (a === 255) expect(v).toBeCloseTo(luma(r!, g!, b!), 3);
      }
    }), runs(RUNS));
  });
});
