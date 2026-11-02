/**
 * Row-major 4×5 color matrices on straight rgba in 0..1, bias column at
 * [4, 9, 14, 19]: the arithmetic the group stack and the batch shader share.
 */

import { clamp01 } from '@weasel-js/geom';

/** `outer ∘ inner`, inner applied first, written into `out` and returned. */
export function composeColorMatrix<T extends Float32Array | number[]>(
  outer: ArrayLike<number>, inner: ArrayLike<number>, out: T,
): T {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = col === 4 ? outer[row * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) sum += outer[row * 5 + k] * inner[k * 5 + col];
      out[row * 5 + col] = sum;
    }
  }
  return out;
}

/** One straight rgba color through `m`, each channel clamped to 0..1. Group alpha is not part of it. */
export function applyColorMatrix(
  m: ArrayLike<number>, r: number, g: number, b: number, a: number,
): [number, number, number, number] {
  return [
    clamp01(m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4]),
    clamp01(m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9]),
    clamp01(m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14]),
    clamp01(m[15] * r + m[16] * g + m[17] * b + m[18] * a + m[19]),
  ];
}
