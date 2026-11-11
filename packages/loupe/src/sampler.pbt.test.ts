/**
 * Property tests of the sampler: a stack read through `createSampler`, its sources answering at once or later,
 * gives what `compositeOver` gives for the same pixels; a single layer reads back as its own bytes; an opaque
 * layer hides everything under it, which is never read; and every channel is a byte.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { rgbaHex } from '@weasel-js/paint';
import { compositeOver, createSampler, type PixelSource } from './sampler';
import { rgbaBytes, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

const layer = fc.record({ px: fc.option(rgbaBytes, { nil: null, freq: 5 }), premultiplied: fc.boolean(), later: fc.boolean() })
  .map(({ px, premultiplied, later }) => ({
    // Premultiplied bytes never exceed their alpha.
    px: px && premultiplied ? [Math.min(px[0], px[3]), Math.min(px[1], px[3]), Math.min(px[2], px[3]), px[3]] : px,
    premultiplied, later,
  }));

describe('createSampler', () => {
  it('composites a stack as compositeOver does, read now or later, and reads nothing under an opaque layer', async () => {
    const seen = tally();
    await fc.assert(fc.asyncProperty(fc.array(layer, { maxLength: 6 }), async (stack) => {
      const reads: number[] = [];
      const sources: PixelSource[] = stack.map((l, i) => ({
        premultiplied: l.premultiplied,
        pixel: () => { reads.push(i); return l.later ? Promise.resolve(l.px) : l.px; },
      }));
      const want = compositeOver([...stack].reverse().map((l) => l.px), [...stack].reverse().map((l) => l.premultiplied));
      const got = await createSampler(sources).rgba({ x: 0, y: 0 });
      expect(got).toEqual(want);
      expect(await createSampler(sources).sample({ x: 0, y: 0 })).toBe(want ? rgbaHex(want) : null);
      if (got) for (const c of got) expect(Number.isInteger(c) && c >= 0 && c <= 255).toBe(true);
      const top = stack.map((l) => l.px?.[3] === 255).lastIndexOf(true);
      seen.count(top >= 0 ? 'opaque' : 'see-through');
      if (top >= 0) expect(reads.every((i) => i >= top)).toBe(true);
      if (stack.some((l) => l.later)) seen.count('later');
    }), runs(RUNS));
    seen.atLeast('opaque', RUNS / 4);
    seen.atLeast('see-through', RUNS / 4);
    seen.atLeast('later', RUNS / 2);
  }, timeoutFor(RUNS, 5));

  it('reads one layer back as its own bytes', () => {
    fc.assert(fc.property(rgbaBytes, fc.boolean(), (px, premultiplied) => {
      fc.pre(px[3] > 0);
      if (!premultiplied) {
        expect(compositeOver([px])).toEqual(px);
        return;
      }
      // Premultiplied bytes come back straight: each channel over alpha, to the nearest byte.
      const p = [Math.min(px[0], px[3]), Math.min(px[1], px[3]), Math.min(px[2], px[3]), px[3]];
      expect(compositeOver([p], [true])).toEqual([...p.slice(0, 3).map((c) => Math.round((c / p[3]!) * 255)), p[3]]);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
