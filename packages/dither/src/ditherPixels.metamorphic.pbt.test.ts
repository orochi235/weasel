/**
 * Metamorphic property tests of CPU dithering, the second pass: a pixel's ink depends on nothing after it in raster
 * order, and a run of rows dithers alike on its own; threshold and Bayer are monotone in the gray and the threshold;
 * the matrix repeats every four dots; a clear pixel dithers as its background; a threshold past either end inks all or
 * nothing; and an image with no pixels answers at once however long its other side, as does its protect mask.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ditherPixels } from './ditherPixels';
import { protectMask } from './protectMask';
import { toGray } from './gray';
import type { DitherMethod, RgbaImage } from './types';
import { METHODS, byte, image, protect, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;

const threshold = fc.oneof(byte, fc.double({ min: -10, max: 300, noNaN: true }));
const ORDERED: readonly DitherMethod[] = ['threshold', 'bayer'];

/** `img` with its pixels from index `from` on replaced by `other`'s. */
function spliced(img: RgbaImage, other: Uint8ClampedArray, from: number): RgbaImage {
  const data = Uint8ClampedArray.from(img.data);
  data.set(other.subarray(from * 4), from * 4);
  return { ...img, data };
}

describe('ditherPixels, metamorphic', () => {
  it('inks each pixel by what comes before it alone, in raster order, for every method', () => {
    const t = tally();
    const input = image().filter((i) => i.width * i.height > 0).chain((img) => fc.record({
      img: fc.constant(img),
      other: fc.array(byte, { minLength: img.data.length, maxLength: img.data.length }).map((a) => Uint8ClampedArray.from(a)),
      from: fc.integer({ min: 0, max: img.width * img.height - 1 }),
      protect: protect(img.width * img.height),
    }));
    fc.assert(fc.property(input, fc.constantFrom(...METHODS), threshold, ({ img, other, from, protect: p }, method, th) => {
      const opts = { method, threshold: th, ...(p ? { protect: p } : {}) };
      const a = ditherPixels(img, opts);
      const b = ditherPixels(spliced(img, other, from), opts);
      expect(b.subarray(0, from)).toEqual(a.subarray(0, from));
      t.count(method);
    }), runs(RUNS));
    for (const m of METHODS) t.atLeast(m, 20);
  }, timeoutFor(RUNS, 3));

  it('dithers the first rows of an image as it dithers those rows alone, 1×N columns included', () => {
    const input = image(10).filter((i) => i.height > 0).chain((img) => fc.record({
      img: fc.constant(img), rows: fc.integer({ min: 0, max: img.height }), protect: protect(img.width * img.height),
    }));
    fc.assert(fc.property(input, fc.constantFrom(...METHODS), threshold, ({ img, rows, protect: p }, method, th) => {
      const n = img.width * rows;
      const top = { width: img.width, height: rows, data: img.data.slice(0, n * 4) };
      const whole = ditherPixels(img, { method, threshold: th, ...(p ? { protect: p } : {}) });
      const alone = ditherPixels(top, { method, threshold: th, ...(p ? { protect: p.slice(0, n) } : {}) });
      expect(whole.subarray(0, n)).toEqual(alone);
    }), runs(RUNS));
  });

  it('never inks a pixel more for being lighter, nor less for a higher threshold, under threshold and Bayer', () => {
    const t = tally();
    const input = image().filter((i) => i.width * i.height > 0).chain((img) => fc.record({
      img: fc.constant(img), lift: fc.array(fc.integer({ min: 0, max: 255 }), { minLength: img.width * img.height, maxLength: img.width * img.height }),
    }));
    fc.assert(fc.property(input, fc.constantFrom(...ORDERED), threshold, fc.double({ min: 0, max: 100, noNaN: true }), ({ img, lift }, method, th, up) => {
      const data = Uint8ClampedArray.from(img.data);
      for (let i = 0; i < lift.length; i++) for (let ch = 0; ch < 3; ch++) data[i * 4 + ch] = Math.min(255, data[i * 4 + ch]! + lift[i]!);
      const lighter = ditherPixels({ ...img, data }, { method, threshold: th });
      const base = ditherPixels(img, { method, threshold: th });
      const higher = ditherPixels(img, { method, threshold: th + up });
      for (let i = 0; i < base.length; i++) {
        expect(lighter[i]!).toBeLessThanOrEqual(base[i]!);
        expect(higher[i]!).toBeGreaterThanOrEqual(base[i]!);
        if (base[i] !== lighter[i]) t.count('lighter lifted ink');
      }
    }), runs(RUNS));
    t.atLeast('lighter lifted ink', 20);
  });

  it('repeats the ordered matrix every four dots: a tiled image dithers to the same tile', () => {
    const input = fc.record({
      tile: fc.array(byte, { minLength: 16, maxLength: 16 }),
      prot: fc.array(fc.constantFrom(0, 0, 1), { minLength: 16, maxLength: 16 }),
      across: fc.integer({ min: 1, max: 4 }),
      down: fc.integer({ min: 1, max: 4 }),
    });
    fc.assert(fc.property(input, threshold, ({ tile, prot, across, down }, th) => {
      const w = 4 * across, h = 4 * down;
      const data = new Uint8ClampedArray(w * h * 4);
      const p = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const k = (y % 4) * 4 + (x % 4);
          data.set([tile[k]!, tile[k]!, tile[k]!, 255], (y * w + x) * 4);
          p[y * w + x] = prot[k]!;
        }
      }
      const out = ditherPixels({ width: w, height: h, data }, { method: 'bayer', threshold: th, protect: p });
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) expect(out[y * w + x]).toBe(out[(y % 4) * w + (x % 4)]);
    }), runs(RUNS));
  });

  it('dithers a clear pixel as its background, whatever color it holds', () => {
    const input = image().chain((img) => fc.record({ img: fc.constant(img), bg: fc.tuple(byte, byte, byte) }));
    fc.assert(fc.property(input, fc.constantFrom(...METHODS), threshold, ({ img, bg }, method, th) => {
      const clear = Uint8ClampedArray.from(img.data);
      const solid = new Uint8ClampedArray(img.data.length);
      for (let i = 0; i < img.width * img.height; i++) {
        clear[i * 4 + 3] = 0;
        solid.set([bg[0], bg[1], bg[2], 255], i * 4);
      }
      expect(ditherPixels({ ...img, data: clear }, { method, threshold: th, background: bg }))
        .toEqual(ditherPixels({ ...img, data: solid }, { method, threshold: th }));
    }), runs(RUNS));
  });

  it('inks everything under an infinite threshold and nothing under minus infinity, for every method', () => {
    fc.assert(fc.property(image(), fc.constantFrom(...METHODS), (img, method) => {
      expect([...ditherPixels(img, { method, threshold: Infinity })].every((v) => v === 1)).toBe(true);
      expect([...ditherPixels(img, { method, threshold: -Infinity })].every((v) => v === 0)).toBe(true);
      expect(toGray(img).every(Number.isFinite)).toBe(true);
    }), runs(RUNS));
  });

  it('answers at once for an image with no pixels, however long its other side, and so does its protect mask', () => {
    const side = fc.oneof(fc.integer({ min: 0, max: 100 }), fc.constantFrom(2 ** 31, 2 ** 40, Number.MAX_SAFE_INTEGER));
    fc.assert(fc.property(side, fc.boolean(), fc.constantFrom(...METHODS), (long, tall, method) => {
      const [width, height] = tall ? [0, long] : [long, 0];
      const started = performance.now();
      expect(ditherPixels({ width, height, data: new Uint8ClampedArray(0) }, { method })).toHaveLength(0);
      expect(protectMask([{ x: -Infinity, y: -Infinity, width: Infinity, height: Infinity }], width, height)).toHaveLength(0);
      expect(performance.now() - started).toBeLessThan(200);
    }), runs(60));
  });
});
