import type { RasterImage } from '@weasel-js/core';

/** One `renderInNode` result's pixels; throws the message of a render that rejected. */
export function nodePixels(render: { width: number; height: number; base64: string } | { error: string }): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  if ('error' in render) throw new Error(`the headless render rejected: ${render.error}`);
  return { width: render.width, height: render.height, data: Uint8Array.from(atob(render.base64), (c) => c.charCodeAt(0)) };
}

/** How far two rasters differ: the pixels that differ at all, and the largest channel step. */
export function difference(
  a: { width: number; height: number; data: ArrayLike<number> },
  b: RasterImage,
): { pixels: number; maxStep: number } {
  if (a.width !== b.width || a.height !== b.height || a.data.length !== b.data.length) {
    throw new Error(
      `difference: a ${a.width} × ${a.height} raster of ${a.data.length} bytes against a ${b.width} × ${b.height} one of ${b.data.length}`,
    );
  }
  let pixels = 0;
  let maxStep = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    let differs = false;
    for (let c = 0; c < 4; c++) {
      const step = Math.abs(a.data[i + c]! - b.data[i + c]!);
      if (step) differs = true;
      maxStep = Math.max(maxStep, step);
    }
    if (differs) pixels++;
  }
  return { pixels, maxStep };
}
