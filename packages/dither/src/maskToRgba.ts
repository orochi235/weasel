import type { Rgba } from './types';

const INK: Rgba = [0, 0, 0, 255];
const BLANK: Rgba = [0, 0, 0, 0];

/** An ink mask as straight RGBA: `ink` where it is set, `blank` elsewhere. */
export function maskToRgba(
  mask: Uint8Array,
  width: number,
  height: number,
  colors: { ink?: Rgba; blank?: Rgba } = {},
): Uint8ClampedArray<ArrayBuffer> {
  if (mask.length !== width * height) {
    throw new RangeError(`maskToRgba: mask holds ${mask.length} pixels, ${width}×${height} needs ${width * height}`);
  }
  const ink = colors.ink ?? INK;
  const blank = colors.blank ?? BLANK;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) out.set(mask[i] ? ink : blank, i * 4);
  return out;
}
