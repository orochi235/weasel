/**
 * The Pixel grid readout: lines on the boundaries between a Pixels lens's
 * enlarged capture pixels, and a tint on each pixel that is a blend of its
 * neighbors, which is where an edge falls between two pixels.
 */
import type { LensSourceKind, LoupePoint } from './lensTypes';

/** The smallest enlargement, in CSS px per captured pixel, at which a grid reads as one. */
export const GRID_MIN_FACTOR = 8;

/** What the Grid toggle says when its lens cannot draw one: `gridFits` wants Pixels at a zoom of
 *  `GRID_MIN_FACTOR` per captured pixel, the lens's factor over the capture's DPR. */
export const GRID_NEEDS = `Grid needs Pixels at ${GRID_MIN_FACTOR}× per captured pixel (zoom ÷ DPR)`;

const LINE_ALPHA = 0.3;
const TINT_ALPHA = 0.35;

/** Whether a lens showing `shown` at `factor`, with a capture at `dpr`, has a grid to draw. */
export function gridFits(shown: LensSourceKind | null, factor: number, dpr: number): boolean {
  return shown === 'pixels' && factor / dpr >= GRID_MIN_FACTOR;
}

/** `bitmap`'s pixels, drawn nearest-neighbor at `size` (its own by default), or null where there is no canvas to read them with. */
export function readBitmap(
  bitmap: ImageBitmap,
  size: { width: number; height: number } = bitmap,
  doc: Document = document,
): ImageData | null {
  const canvas = doc.createElement('canvas');
  canvas.width = Math.max(1, size.width);
  canvas.height = Math.max(1, size.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Along one axis, whether `p` lies strictly between `a` and `b`, more than `tol` from each, in a channel. */
const between = (a: number, p: number, b: number, tol: number): boolean =>
  p - Math.min(a, b) > tol && Math.max(a, b) - p > tol;

/** A channel two neighbors and a pixel agree on, within `tol`: nothing to blend there. */
const flat = (a: number, p: number, b: number, tol: number): boolean =>
  Math.abs(a - p) <= tol && Math.abs(b - p) <= tol;

/**
 * Which pixels of `img` are a blend: 1 where a pixel lies strictly between its
 * two opposite neighbors, on either axis, by more than `tolerance`, in every
 * color channel that differs between them. A channel the neighbors agree on
 * counts as met, so a blend of two colors sharing one is still found. A pixel
 * on the image's edge has no neighbors on that axis.
 */
export function softEdgeMask(img: ImageData, tolerance = 8): Uint8Array {
  const { width, height, data } = img;
  const mask = new Uint8Array(width * height);
  const at = (x: number, y: number, c: number) => data[(y * width + x) * 4 + c] as number;
  const blended = (x: number, y: number, dx: number, dy: number): boolean => {
    let strict = false;
    for (let c = 0; c < 3; c += 1) {
      const a = at(x - dx, y - dy, c);
      const p = at(x, y, c);
      const b = at(x + dx, y + dy, c);
      if (between(a, p, b, tolerance)) strict = true;
      else if (!flat(a, p, b, tolerance)) return false;
    }
    return strict;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const across = x > 0 && x < width - 1 && blended(x, y, 1, 0);
      const down = y > 0 && y < height - 1 && blended(x, y, 0, 1);
      if (across || down) mask[y * width + x] = 1;
    }
  }
  return mask;
}

/** Where a grid is drawn, in the CSS px of a context already scaled to the screen. */
export interface PixelGridView {
  /** CSS px per host px: each captured pixel is `factor / dpr` wide. */
  factor: number;
  /** Captured pixels per host px. */
  dpr: number;
  /** Where the capture's first pixel begins. */
  origin: LoupePoint;
  /** The capture's width in pixels, which is the mask's row length. */
  columns: number;
  /** The area to draw into. */
  size: { width: number; height: number };
}

/**
 * Clears `ctx`'s area and, at `GRID_MIN_FACTOR` and up, draws a line on each
 * pixel boundary and tints each pixel `mask` marks.
 */
export function drawPixelGrid(
  ctx: CanvasRenderingContext2D,
  view: PixelGridView,
  mask: Uint8Array | null,
  colors: { line: string; tint: string },
): void {
  const { factor, dpr, origin, columns, size } = view;
  ctx.clearRect(0, 0, size.width, size.height);
  const step = factor / dpr;
  if (!gridFits('pixels', factor, dpr)) return;
  const first = (from: number, at: number) => Math.max(0, Math.ceil((from - at) / step));
  ctx.save();
  if (mask && columns > 0) {
    const rows = Math.floor(mask.length / columns);
    ctx.globalAlpha = TINT_ALPHA;
    ctx.fillStyle = colors.tint;
    const last = (to: number, at: number, n: number) =>
      Math.min(n - 1, Math.floor((to - at) / step));
    for (
      let j = Math.max(0, Math.floor(-origin.y / step));
      j <= last(size.height, origin.y, rows);
      j += 1
    ) {
      for (
        let i = Math.max(0, Math.floor(-origin.x / step));
        i <= last(size.width, origin.x, columns);
        i += 1
      ) {
        if (mask[j * columns + i])
          ctx.fillRect(origin.x + i * step, origin.y + j * step, step, step);
      }
    }
  }
  ctx.globalAlpha = LINE_ALPHA;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = origin.x + first(0, origin.x) * step; x <= size.width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size.height);
  }
  for (let y = origin.y + first(0, origin.y) * step; y <= size.height; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(size.width, y);
  }
  ctx.stroke();
  ctx.restore();
}
