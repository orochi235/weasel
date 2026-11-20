import { describe, expect, it } from 'vitest';
import { dither } from './dither';

describe('dither (GPU)', () => {
  it('is one pass, reaching nothing on the screen grid', () => {
    const fx = dither();
    expect(fx).toHaveLength(1);
    expect(fx[0]!.reach).toBe(0);
    expect(fx[0]!.uniforms).toMatchObject({ u_method: 0, u_threshold: 128, u_pitch: [1, 1], u_gridOrigin: [0, 0] });
  });

  it('reaches one dot on an output grid', () => {
    const [fx] = dither({ method: 'bayer', grid: { pitch: [3.2, 3.2], origin: [5, 5] } });
    expect(fx!.reach).toBe(4);
    expect(fx!.uniforms).toMatchObject({ u_method: 1, u_pitch: [3.2, 3.2], u_gridOrigin: [5, 5] });
  });

  it('is anchored to the screen when it picks a Bayer cell or a dot by device pixel, so a pan draws it again', () => {
    expect(dither()[0]!.screenAnchored).toBeFalsy();
    expect(dither({ method: 'bayer' })[0]!.screenAnchored).toBe(true);
    expect(dither({ grid: { pitch: [2, 2], origin: [0, 0] } })[0]!.screenAnchored).toBe(true);
  });

  it('premultiplies its colors and scales them to 0–1', () => {
    const [fx] = dither({ ink: [255, 0, 0, 128], blank: [0, 0, 0, 0], background: [255, 255, 255] });
    const ink = fx!.uniforms!.u_ink as number[];
    expect(ink[0]).toBeCloseTo(128 / 255);
    expect(ink[3]).toBeCloseTo(128 / 255);
    expect(fx!.uniforms!.u_background).toEqual([1, 1, 1]);
  });

  it('refuses error diffusion, which no fragment shader can compute', () => {
    expect(() => dither({ method: 'floyd-steinberg' as never })).toThrow(/CPU/);
    expect(() => dither({ method: 'atkinson' as never })).toThrow(/CPU/);
  });

  it('refuses a method nobody knows without calling it error diffusion', () => {
    expect(() => dither({ method: 'ordered' as never })).toThrow(/'ordered' is not a method it takes \(threshold, bayer\)$/);
  });

  it('refuses a protect mask on the screen grid, since the mask is in dots', () => {
    const protect = { texture: { id: 'tex_test' }, width: 1, height: 1 };
    expect(() => dither({ protect })).toThrow(/output grid/);
    expect(() => dither({ grid: 'screen', protect })).toThrow(/output grid/);
  });

  it('reaches one dot under a flipped axis, and keeps the signed pitch', () => {
    const [fx] = dither({ grid: { pitch: [2.5, -3.2], origin: [5, 50] } });
    expect(fx!.reach).toBe(4);
    expect(fx!.uniforms).toMatchObject({ u_pitch: [2.5, -3.2] });
  });

  it('passes a protect texture with its size', () => {
    const texture = { id: 'tex_test' };
    const [fx] = dither({ grid: { pitch: [2, 2], origin: [0, 0] }, protect: { texture, width: 12, height: 6 } });
    expect(fx!.uniforms).toMatchObject({ u_protect: texture, u_protectSize: [12, 6] });
  });

  it('places dots exactly in float32 however far the grid origin lies from the buffer', () => {
    // A grid at the document origin, seen from 2e6 pt away at 8 device px per pt.
    const grid = { pitch: [3.25, -3.25] as const, origin: [-1.6e7, 1.6e7 + 0.3] as const };
    const [fx] = dither({ method: 'bayer', grid, protect: { texture: { id: 'tex_test' }, width: 4, height: 4 } });
    const u = fx!.uniforms as { u_pitch: number[]; u_gridOrigin: number[]; u_dotOffset: number[] };
    const f = Math.fround;
    for (let axis = 0; axis < 2; axis++) {
      const pitch = grid.pitch[axis]!;
      expect(Math.abs(u.u_gridOrigin[axis]!)).toBeLessThan(4 * Math.abs(pitch));
      expect(u.u_dotOffset[axis]! % 4).toBe(0);
      for (let px = 0.5; px < 256; px += 1) {
        // What the shader computes, in float32: the dot, then the dot counted from the grid's dot 0.
        const local = Math.floor(f(f(f(px) - f(u.u_gridOrigin[axis]!)) / f(pitch)));
        const shader = f(local + f(u.u_dotOffset[axis]!));
        expect(shader).toBe(Math.floor((px - grid.origin[axis]!) / pitch));
        expect(((local % 4) + 4) % 4).toBe(((shader % 4) + 4) % 4);
      }
    }
  });
});
