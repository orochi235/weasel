import { rgbaToHex, tryParseColor } from '@weasel-js/paint';

function hexOf(v: string): string | null {
  const rgba = tryParseColor(v);
  return rgba && rgbaToHex([rgba[0], rgba[1], rgba[2]]);
}

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

/** `value` as the `#rrggbb` a color input takes, alpha dropped; null when it cannot be converted. */
export function toHex(value: string): string | null {
  const v = value.trim();
  const direct = hexOf(v);
  if (direct) return direct;
  const browser = typeof document === 'undefined' ? null : serialized(v);
  return browser && browser !== v ? hexOf(browser) : null;
}
