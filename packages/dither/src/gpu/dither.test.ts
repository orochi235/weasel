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

  it('premultiplies its colors and scales them to 0–1', () => {
    const [fx] = dither({ ink: [255, 0, 0, 128], blank: [0, 0, 0, 0], background: [255, 255, 255] });
    const ink = fx!.uniforms!.u_ink as number[];
    expect(ink[0]).toBeCloseTo(128 / 255);
    expect(ink[3]).toBeCloseTo(128 / 255);
    expect(fx!.uniforms!.u_background).toEqual([1, 1, 1]);
  });

  it('refuses error diffusion, which no fragment shader can compute', () => {
    expect(() => dither({ method: 'floyd-steinberg' as never })).toThrow(/CPU/);
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
});
