import { describe, it, expect } from 'vitest';
import { MAX_VECTOR_RASTER_PIXELS, firstVectorRasterSize } from './imageLoader';
import { maxImageTextureSide } from '../cache/GLImageCache';

describe('firstVectorRasterSize', () => {
  it('keeps a declared size inside the caps', () => {
    expect(firstVectorRasterSize(300, 150)).toEqual({ width: 300, height: 150 });
  });

  it('scales a huge declared size down to the texture side and the pixel ceiling, keeping its shape', () => {
    const { width, height } = firstVectorRasterSize(40_000, 20_000);
    expect(Math.max(width, height)).toBeLessThanOrEqual(maxImageTextureSide());
    expect(width * height).toBeLessThanOrEqual(MAX_VECTOR_RASTER_PIXELS);
    expect(width / height).toBeCloseTo(2, 2);
  });
});
