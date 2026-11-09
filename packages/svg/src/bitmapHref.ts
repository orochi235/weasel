/**
 * A `bitmapSrc` names a bitmap made at runtime, which no other document can
 * load, so an exported image or image pattern carries its pixels instead.
 */
import { getImageBitmap, imageStatus, isBitmapSrc } from '@weasel-js/core';

/** `href` as an exported document can load it: a held `bitmapSrc` bitmap as a
 *  PNG data URL, anything else as it is. Where no 2D canvas can draw the
 *  bitmap (no DOM, a closed bitmap), the name is kept and `warn` says so. */
export function exportedHref(href: string, warn: (m: string) => void): string {
  if (!isBitmapSrc(href)) return href;
  // `imageStatus` reads without starting a load, which a name from another realm would.
  const bitmap = imageStatus(href) === 'ready' ? getImageBitmap(href) : undefined;
  const url = bitmap ? pngDataUrl(bitmap) : null;
  if (url) return url;
  warn(`image ${href} names a bitmap made at runtime that could not be drawn here; written as its name, which no other document can load`);
  return href;
}

function pngDataUrl(bitmap: ImageBitmap): string | null {
  if (bitmap.width === 0 || bitmap.height === 0) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const url = canvas.toDataURL('image/png');
    return url.startsWith('data:image/png') ? url : null;
  } catch {
    return null;
  }
}
