import { parseColor } from '@weasel-js/paint';
import type { DrawState } from './drawCommands';

export type Rgba = [number, number, number, number];

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A row-major 4x5 matrix on straight rgba in 0..1, clamped; null is identity. Group alpha is not part of it. */
export function foldColor(rgba: readonly [number, number, number, number], m: readonly number[] | null): Rgba {
  const [r, g, b, a] = rgba;
  if (!m) return [r, g, b, a];
  const row = (i: number): number => clamp01(m[i] * r + m[i + 1] * g + m[i + 2] * b + m[i + 3] * a + m[i + 4]);
  return [row(0), row(5), row(10), row(15)];
}

/** `inner` applied first, then `outer`: the order the renderer's group stack composes them in. */
export function composeMatrix(outer: readonly number[] | null, inner: readonly number[] | undefined): number[] | null {
  if (!inner) return outer ? [...outer] : null;
  if (!outer) return [...inner];
  const out = new Array<number>(20);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = col === 4 ? outer[row * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) sum += outer[row * 5 + k] * inner[k * 5 + col];
      out[row * 5 + col] = sum;
    }
  }
  return out;
}

/** Every color the writer emits comes through here, so a color matrix has one place to apply. */
export function colorFor(color: string | readonly [number, number, number, number], state: DrawState): Rgba {
  return foldColor(typeof color === 'string' ? parseColor(color) : color, state.colorMatrix);
}

/** Every image pixel comes through here, so a color matrix has one place to apply. Straight RGBA in, straight RGBA out. */
export function foldPixels(data: Uint8ClampedArray, state: DrawState): Uint8ClampedArray {
  if (!state.colorMatrix) return data;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i + 3 < data.length; i += 4) {
    const [r, g, b, a] = foldColor(
      [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, data[i + 3] / 255],
      state.colorMatrix,
    );
    out[i] = r * 255;
    out[i + 1] = g * 255;
    out[i + 2] = b * 255;
    out[i + 3] = a * 255;
  }
  return out;
}
