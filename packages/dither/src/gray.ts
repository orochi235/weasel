import { LUMA, WHITE } from './shared';
import type { Rgb, RgbaImage } from './types';

/** Each pixel's gray, 0–255, after compositing it over `background`. */
export function toGray(image: RgbaImage, background: Rgb = WHITE): Float32Array {
  const n = image.width * image.height;
  const gray = new Float32Array(n);
  const d = image.data;
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3]! / 255;
    const r = d[i * 4]! * a + background[0] * (1 - a);
    const g = d[i * 4 + 1]! * a + background[1] * (1 - a);
    const b = d[i * 4 + 2]! * a + background[2] * (1 - a);
    gray[i] = LUMA[0] * r + LUMA[1] * g + LUMA[2] * b;
  }
  return gray;
}
