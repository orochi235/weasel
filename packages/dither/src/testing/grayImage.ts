import type { RgbaImage } from '../types';

/** A width × height image where pixel (x, y) is the opaque gray `at(x, y)`. */
export function grayImage(width: number, height: number, at: (x: number, y: number) => number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = at(x, y);
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
  }
  return { width, height, data };
}
