import { parseColor, type SolidPaint } from '@weasel-js/paint';
import { applyColorMatrix, composeColorMatrix } from '@weasel-js/renderer';
import type { DrawState } from './drawCommands';

export type Rgba = [number, number, number, number];

/** A row-major 4x5 matrix on straight rgba in 0..1, clamped; null is identity. Group alpha is not part of it. */
export function foldColor(rgba: readonly [number, number, number, number], m: readonly number[] | null): Rgba {
  const [r, g, b, a] = rgba;
  return m ? applyColorMatrix(m, r, g, b, a) : [r, g, b, a];
}

/** `inner` applied first, then `outer`: the order the renderer's group stack composes them in. */
export function composeMatrix(outer: readonly number[] | null, inner: readonly number[] | undefined): number[] | null {
  if (!inner) return outer ? [...outer] : null;
  if (!outer) return [...inner];
  return composeColorMatrix(outer, inner, new Array<number>(20));
}

/** Every color the writer emits comes through here, so a color matrix has one place to apply. */
export function colorFor(color: string | readonly [number, number, number, number], state: DrawState): Rgba {
  return foldColor(typeof color === 'string' ? parseColor(color) : color, state.colorMatrix);
}

/** A solid paint's color under `state`, and the alpha it paints at: its own, its opacity's and the group's. */
export function solidColor(paint: SolidPaint, state: DrawState): { rgb: [number, number, number]; alpha: number } {
  const [r, g, b, a] = colorFor(paint.color, state);
  return { rgb: [r, g, b], alpha: a * (paint.opacity ?? 1) * state.alpha };
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
