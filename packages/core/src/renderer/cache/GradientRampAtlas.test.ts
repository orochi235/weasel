import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import {
  buildGradientRamp, GradientRampAtlas, RAMP_ATLAS_MAX_ROWS, RAMP_WIDTH,
} from './GradientRampAtlas';
import type { GradStop } from '@weasel-js/core';
import { sampleGradientStops } from '../../core/gradient';
import { parseColorToRgba255 } from '../math/color';

const BLACK_WHITE: GradStop[] = [
  { offset: 0, color: '#000000' },
  { offset: 1, color: '#ffffff' },
];

const RED_BLUE: GradStop[] = [
  { offset: 0, color: '#ff0000' },
  { offset: 1, color: '#0000ff' },
];

describe('buildGradientRamp', () => {
  it('returns a Uint8ClampedArray of length 256 × 4', () => {
    const ramp = buildGradientRamp(BLACK_WHITE);
    expect(ramp).toBeInstanceOf(Uint8ClampedArray);
    expect(ramp.length).toBe(256 * 4);
  });

  it('first pixel is the first stop color', () => {
    const ramp = buildGradientRamp(BLACK_WHITE);
    expect(Array.from(ramp.slice(0, 4))).toEqual([0, 0, 0, 255]);
  });

  it('last pixel is the last stop color', () => {
    const ramp = buildGradientRamp(BLACK_WHITE);
    expect(Array.from(ramp.slice(255 * 4, 256 * 4))).toEqual([255, 255, 255, 255]);
  });

  it('midpoint pixel is a linear blend', () => {
    const ramp = buildGradientRamp(BLACK_WHITE);
    const [r, g, b, a] = ramp.slice(128 * 4, 128 * 4 + 4);
    expect(r).toBeGreaterThanOrEqual(127);
    expect(r).toBeLessThanOrEqual(129);
    expect(g).toBe(r);
    expect(b).toBe(r);
    expect(a).toBe(255);
  });

  it('multi-stop: pixel before midstop is interpolated from stop 0 to stop 1', () => {
    const stops: GradStop[] = [
      { offset: 0,   color: '#ff0000' },
      { offset: 0.5, color: '#00ff00' },
      { offset: 1,   color: '#0000ff' },
    ];
    const ramp = buildGradientRamp(stops);
    const [r, g, b] = ramp.slice(64 * 4, 64 * 4 + 4);
    expect(r).toBeGreaterThan(100);
    expect(g).toBeGreaterThan(100);
    expect(b).toBeLessThan(20);
  });

  it('single-stop ramp fills entirely with that color', () => {
    const stops: GradStop[] = [{ offset: 0, color: '#ff0000' }];
    const ramp = buildGradientRamp(stops);
    for (let i = 0; i < 256; i++) {
      expect(ramp[i * 4]).toBe(255);
      expect(ramp[i * 4 + 1]).toBe(0);
      expect(ramp[i * 4 + 2]).toBe(0);
      expect(ramp[i * 4 + 3]).toBe(255);
    }
  });
});

describe('GradientRampAtlas', () => {
  /** Every row written since the recorder was last reset, as [row, texels]. */
  function writtenRows(calls: readonly { name: string; args: readonly unknown[] }[]) {
    return calls
      .filter((c) => c.name === 'texSubImage2D')
      .map((c) => [c.args[3] as number, c.args[8] as Uint8ClampedArray] as const);
  }

  /** The size the atlas texture was last specified at, as [width, height]. */
  function specifiedSize(calls: readonly { name: string; args: readonly unknown[] }[]) {
    const spec = calls.filter((c) => c.name === 'texImage2D').at(-1);
    return spec ? [spec.args[3] as number, spec.args[4] as number] : undefined;
  }

  /** `n` stop lists no two of which stringify the same. */
  function distinctRamps(n: number): GradStop[][] {
    return Array.from({ length: n }, (_, i) => [
      { offset: 0, color: `rgb(${i % 256}, ${(i >> 8) % 256}, 0)` },
      { offset: 1, color: '#ffffff' },
    ]);
  }

  it('upload() creates one texture and specifies it 256 wide', () => {
    const { gl, calls } = makeGLRecorder();
    const atlas = new GradientRampAtlas(gl);
    atlas.upload(BLACK_WHITE);
    expect(calls.filter((c) => c.name === 'createTexture')).toHaveLength(1);
    expect(specifiedSize(calls)![0]).toBe(RAMP_WIDTH);
  });

  it('upload() writes the baked ramp into the row it hands back', () => {
    const { gl, calls, reset } = makeGLRecorder();
    const atlas = new GradientRampAtlas(gl);
    reset();
    const row = atlas.upload(RED_BLUE);
    const written = writtenRows(calls);
    expect(written).toHaveLength(1);
    expect(written[0][0]).toBe(row);
    expect(Array.from(written[0][1].slice(0, 4))).toEqual([255, 0, 0, 255]);
  });

  it('upload() for identical stops reuses the row without rewriting it', () => {
    const { gl, calls, reset } = makeGLRecorder();
    const atlas = new GradientRampAtlas(gl);
    const first = atlas.upload(BLACK_WHITE);
    reset();
    expect(atlas.upload([...BLACK_WHITE])).toBe(first);
    expect(writtenRows(calls)).toHaveLength(0);
  });

  it('upload() for different stops takes a different row', () => {
    const { gl } = makeGLRecorder();
    const atlas = new GradientRampAtlas(gl);
    expect(atlas.upload(BLACK_WHITE)).not.toBe(atlas.upload(RED_BLUE));
  });

  it('every ramp in the atlas shares one texture', () => {
    const { gl, calls } = makeGLRecorder();
    const atlas = new GradientRampAtlas(gl);
    for (const stops of distinctRamps(40)) atlas.upload(stops);
    expect(calls.filter((c) => c.name === 'createTexture')).toHaveLength(1);
  });

  // The whole point of the atlas: a gradient samples the unit its neighbours
  // sample, so a row's `v` is what tells it apart. LINEAR filtering means a
  // `v` off the row center blends the ramp beside it in.
  it('rowV() is the center of the row, in the atlas as it now stands', () => {
    const { gl } = makeGLRecorder();
    const atlas = new GradientRampAtlas(gl);
    const row = atlas.upload(BLACK_WHITE);
    expect(atlas.rowV(row)).toBeCloseTo((row + 0.5) / atlas.height, 12);
    expect(atlas.rowV(row) * atlas.height - row).toBeCloseTo(0.5, 12);
  });

  it('growing keeps a row at the index it was handed out under', () => {
    const { gl, calls } = makeGLRecorder();
    const atlas = new GradientRampAtlas(gl);
    const ramps = distinctRamps(40);
    const rows = ramps.map((stops) => atlas.upload(stops));
    expect(atlas.height).toBeGreaterThanOrEqual(40);
    expect(specifiedSize(calls)![1]).toBe(atlas.height);
    // Re-asking is a hit, and a hit returns the row the caller already holds.
    expect(ramps.map((stops) => atlas.upload(stops))).toEqual(rows);
    expect(new Set(rows).size).toBe(rows.length);
  });

  it('growing carries the rows already in the atlas into the new texture', () => {
    const { gl, calls } = makeGLRecorder();
    const atlas = new GradientRampAtlas(gl);
    const row = atlas.upload(RED_BLUE);
    for (const stops of distinctRamps(40)) atlas.upload(stops);
    const spec = calls.filter((c) => c.name === 'texImage2D').at(-1)!;
    const pixels = spec.args[8] as Uint8ClampedArray;
    const at = row * RAMP_WIDTH * 4;
    expect(Array.from(pixels.slice(at, at + 4))).toEqual([255, 0, 0, 255]);
  });

  it('recycles the least recently used row once it cannot grow', () => {
    const { gl } = makeGLRecorder();
    const atlas = new GradientRampAtlas(gl);
    const ramps = distinctRamps(RAMP_ATLAS_MAX_ROWS);
    const rows = ramps.map((stops) => atlas.upload(stops));
    expect(atlas.height).toBe(RAMP_ATLAS_MAX_ROWS);

    // Touching the oldest makes the second-oldest the one to go.
    atlas.upload(ramps[0]);
    const recycled = atlas.upload(distinctRamps(RAMP_ATLAS_MAX_ROWS + 1).at(-1)!);
    expect(recycled).toBe(rows[1]);
    expect(atlas.height).toBe(RAMP_ATLAS_MAX_ROWS);
  });

  describe('wouldReshape()', () => {
    it('is false on an empty atlas, whose first growth moves nothing', () => {
      const { gl } = makeGLRecorder();
      expect(new GradientRampAtlas(gl).wouldReshape(BLACK_WHITE)).toBe(false);
    });

    it('is false for a stop list already in a row', () => {
      const { gl } = makeGLRecorder();
      const atlas = new GradientRampAtlas(gl);
      atlas.upload(BLACK_WHITE);
      expect(atlas.wouldReshape([...BLACK_WHITE])).toBe(false);
    });

    it('is false while there are rows left, and true for the one that grows it', () => {
      const { gl } = makeGLRecorder();
      const atlas = new GradientRampAtlas(gl);
      const ramps = distinctRamps(RAMP_ATLAS_MAX_ROWS);
      atlas.upload(ramps[0]);
      const rows = atlas.height;
      for (let i = 1; i < rows; i++) {
        expect(atlas.wouldReshape(ramps[i]), `row ${i} of ${rows}`).toBe(false);
        atlas.upload(ramps[i]);
      }
      expect(atlas.wouldReshape(ramps[rows])).toBe(true);
    });
  });

  it('bind() selects the unit and binds the atlas', () => {
    const { gl, calls, reset } = makeGLRecorder();
    const atlas = new GradientRampAtlas(gl);
    atlas.upload(BLACK_WHITE);
    reset();
    atlas.bind(1);
    expect(calls.find((c) => c.name === 'activeTexture')!.args[0]).toBe(gl.TEXTURE0 + 1);
    expect(calls.some((c) => c.name === 'bindTexture')).toBe(true);
  });

  it('hitRate() returns a number in [0, 1]', () => {
    const { gl } = makeGLRecorder();
    const atlas = new GradientRampAtlas(gl);
    atlas.upload(BLACK_WHITE);
    atlas.upload(BLACK_WHITE);
    atlas.upload(BLACK_WHITE);
    expect(atlas.hitRate()).toBeGreaterThanOrEqual(0);
    expect(atlas.hitRate()).toBeLessThanOrEqual(1);
  });

  it('free() deletes the atlas texture and forgets its rows', () => {
    const { gl, calls, reset } = makeGLRecorder();
    const atlas = new GradientRampAtlas(gl);
    atlas.upload(BLACK_WHITE);
    atlas.upload(RED_BLUE);
    reset();
    atlas.free();
    expect(calls.filter((c) => c.name === 'deleteTexture')).toHaveLength(1);
    reset();
    atlas.upload(BLACK_WHITE);
    expect(calls.some((c) => c.name === 'createTexture')).toBe(true);
  });
});

// The GL ramp and the editor's stop sampler answer the same question, so a
// disagreement between them is a gradient that paints differently from the
// swatch that authored it.
describe('ramp / editor agreement', () => {
  function rampAt(stops: GradStop[], texel: number): number[] {
    const ramp = buildGradientRamp(stops);
    return Array.from(ramp.slice(texel * 4, texel * 4 + 4));
  }

  function editorAt(stops: GradStop[], texel: number): number[] {
    return parseColorToRgba255(sampleGradientStops(stops, texel / 255));
  }

  function expectAgreement(stops: GradStop[], texels: number[]): void {
    for (const texel of texels) {
      const ramp = rampAt(stops, texel);
      const editor = editorAt(stops, texel);
      for (let c = 0; c < 4; c++) {
        expect(
          Math.abs(ramp[c] - editor[c]),
          `texel ${texel} channel ${c}: ramp ${ramp} vs editor ${editor}`,
        ).toBeLessThanOrEqual(1);
      }
    }
  }

  it('agrees below the first stop', () => {
    expectAgreement(
      [{ offset: 0.5, color: '#808080' }, { offset: 1, color: '#a0b0c0' }],
      [0, 32, 64, 128, 192, 255],
    );
  });

  it('agrees above the last stop', () => {
    expectAgreement(
      [{ offset: 0, color: '#a0b0c0' }, { offset: 0.5, color: '#808080' }],
      [0, 64, 128, 192, 255],
    );
  });

  it('agrees on the tie-break at a coincident pair', () => {
    const c = 128 / 255;
    expectAgreement(
      [
        { offset: 0, color: '#ff0000' },
        { offset: c, color: '#00ff00' },
        { offset: c, color: '#0000ff' },
        { offset: 1, color: '#0000ff' },
      ],
      [0, 64, 128, 192, 255],
    );
  });

  it('agrees on a stop written as a CSS named color', () => {
    expectAgreement(
      [{ offset: 0, color: 'red' }, { offset: 1, color: 'blue' }],
      [0, 128, 255],
    );
  });
});
