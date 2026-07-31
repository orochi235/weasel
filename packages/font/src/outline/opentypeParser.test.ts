/**
 * The parser against real font bytes — the bundled subset Inter, which is the
 * face the default `sans-serif` family renders from.
 *
 * Everything else in this directory is tested against a stub face, which
 * proves the plumbing and nothing about the contract that matters most: that
 * `glyphD` returns *em space, y-down, baseline at the origin*. Get that wrong
 * by a factor of `unitsPerEm` or a sign and the outline tier still runs, still
 * batches, still caches — and paints glyphs 2048× too large, or upside down.
 * So this asserts the geometry directly.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openTypeParser } from './opentypeParser';
import type { OutlineFace } from './OutlineFace';

const INTER_TTF = resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf');

function bytes(): ArrayBuffer {
  const buf = readFileSync(INTER_TTF);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** Every coordinate pair in a `d` string, as [x, y]. */
function points(d: string): [number, number][] {
  const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

describe.skipIf(!existsSync(INTER_TTF))('opentype parser, bundled Inter subset', () => {
  let face: OutlineFace;
  beforeAll(async () => { face = await openTypeParser(bytes()); });

  it('reports the em the atlas was baked against', () => {
    // The baked atlas records size 32 / base 31 — 0.96875 em — and the subset
    // ships from the same source. If these ever disagree, the two tiers put
    // the baseline in different places and text jumps at the threshold.
    expect(face.unitsPerEm).toBe(2048);
  });

  it('emits em-space geometry: unit scale, y-down, baseline at the origin', () => {
    const d = face.glyphD(72)!; // 'H' — flat top and bottom, no overshoot
    expect(d).toBeTruthy();
    const ys = points(d).map(([, y]) => y);
    const xs = points(d).map(([x]) => x);

    // Cap height above the baseline is negative y, roughly 0.73 em for Inter.
    expect(Math.min(...ys)).toBeGreaterThan(-1);
    expect(Math.min(...ys)).toBeLessThan(-0.6);
    // 'H' sits on the baseline: nothing below it.
    expect(Math.max(...ys)).toBeCloseTo(0, 5);
    // And it starts at the pen, not at some font-unit offset.
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1.5);
  });

  it('puts descenders below the baseline', () => {
    const ys = points(face.glyphD(112)!).map(([, y]) => y); // 'p'
    expect(Math.max(...ys)).toBeGreaterThan(0.1);
  });

  it('emits multiple contours for a counter, so the hole can be cut', () => {
    // 'o' is an outer contour plus a counter; a single-contour answer here
    // would paint a filled blob.
    const d = face.glyphD(111)!;
    expect((d.match(/M/g) ?? []).length).toBe(2);
  });

  it('reports a glyph the subset does not carry as null', () => {
    // Outside U+0020–00FF. `.notdef` is a real glyph and would render as a
    // tofu box, silently replacing a character the SDF tier might serve.
    expect(face.glyphD(0x4e00)).toBeNull();
  });

  it('reports a space as null — nothing to tessellate', () => {
    expect(face.glyphD(32)).toBeNull();
  });

  it('never emits exponential notation, which the `d` tokenizer would misread', () => {
    // `pathFromD` splits argument runs on letters, so a coordinate printed as
    // `1e-7` would tokenize as the command `e`. Five decimals cannot produce
    // one — assert it across the whole charset rather than trusting that.
    for (let cp = 0x20; cp <= 0xff; cp++) {
      const d = face.glyphD(cp);
      if (d) expect(d).not.toMatch(/[eE]/);
    }
  });
});
