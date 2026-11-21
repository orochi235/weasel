import { rgbaToHex, tryParseColor } from '@weasel-js/paint';


let paint: CanvasRenderingContext2D | null | undefined;

/** The browser's serialization of a color, through a canvas fill style; null where it has none or rejects `value`. */
function serialized(value: string): string | null {
  if (paint === undefined) {
    try {
      paint = document.createElement('canvas').getContext('2d');
    } catch {
      paint = null;
    }
  }
  if (!paint) return null;
  // A rejected value leaves the previous fill style, so two different ones tell a rejection apart.
  paint.fillStyle = '#000000';
  paint.fillStyle = value;
  const onBlack = String(paint.fillStyle);
  paint.fillStyle = '#ffffff';
  paint.fillStyle = value;
  return onBlack === String(paint.fillStyle) ? onBlack : null;
}

function rgbaOf(value: string): readonly [number, number, number, number] | null {
  const v = value.trim();
  const direct = tryParseColor(v);
  if (direct) return direct;
  const browser = typeof document === 'undefined' ? null : serialized(v);
  return browser && browser !== v ? tryParseColor(browser) : null;
}

/** `value` as the `#rrggbb` a color input takes, alpha dropped; null when it cannot be converted. */
export function toHex(value: string): string | null {
  const rgba = rgbaOf(value);
  return rgba && rgbaToHex([rgba[0], rgba[1], rgba[2]]);
}

/** `hex`, a color input's pick, carrying the alpha of `value`, the color it replaces: `#rrggbbaa` when that is translucent. */
export function keepAlpha(hex: string, value: string): string {
  const alpha = rgbaOf(value)?.[3] ?? 1;
  const picked = tryParseColor(hex);
  return alpha >= 1 || !picked ? hex : rgbaToHex([picked[0], picked[1], picked[2], alpha]);
}
