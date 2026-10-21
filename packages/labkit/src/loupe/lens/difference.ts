/**
 * The Difference view: which pixels of two captures differ, and how a lens
 * draws that enlarged about its reticle.
 */
import type { LensCapture } from './lensSource';
import { readBitmap } from './pixelGrid';

export interface DiffResult {
  image: ImageData;
  /** How many pixels differ. */
  changed: number;
}

export interface DiffOptions {
  /** The largest difference in any one channel still counted as the same. Default 0. */
  tolerance?: number;
  /** The color a differing pixel is lit in. Default magenta. */
  lit?: readonly [number, number, number];
  /** What an unchanged pixel's alpha is multiplied by. Default 0.25. */
  dim?: number;
}

const MAGENTA = [255, 0, 255] as const;

/** `a` with every pixel that differs from `b` lit and the rest dimmed. The two must be the same size. */
export function diffPixels(a: ImageData, b: ImageData, opts: DiffOptions = {}): DiffResult {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`diffPixels: size ${a.width}×${a.height} against ${b.width}×${b.height}`);
  }
  const { tolerance = 0, lit = MAGENTA, dim = 0.25 } = opts;
  const out = new Uint8ClampedArray(a.data.length);
  let changed = 0;
  for (let i = 0; i < out.length; i += 4) {
    let differs = false;
    for (let c = 0; c < 4; c += 1) {
      if (Math.abs((a.data[i + c] as number) - (b.data[i + c] as number)) > tolerance) differs = true;
    }
    if (differs) {
      changed += 1;
      out[i] = lit[0];
      out[i + 1] = lit[1];
      out[i + 2] = lit[2];
      out[i + 3] = 255;
    } else {
      out[i] = a.data[i] as number;
      out[i + 1] = a.data[i + 1] as number;
      out[i + 2] = a.data[i + 2] as number;
      out[i + 3] = Math.round((a.data[i + 3] as number) * dim);
    }
  }
  return { image: new ImageData(out, a.width, a.height), changed };
}

/** `capture`'s pixels at `dpr` px per host px, enlarged nearest-neighbor when it was taken at fewer. */
function pixelsOf(doc: Document, capture: LensCapture, dpr: number): ImageData | null {
  return readBitmap(
    capture.bitmap,
    { width: Math.round(capture.box.width * dpr), height: Math.round(capture.box.height * dpr) },
    doc,
  );
}

/** Where a lens draws, and how far it enlarges. */
export interface DifferenceView {
  /** The interior, in CSS px. */
  size: { width: number; height: number };
  factor: number;
}

/**
 * Draws the difference of `base` and `compared` into `canvas`, `factor` times
 * its CSS size about the reticle, every pixel kept square. Two captures at
 * different DPRs are compared at the finer one. Returns how many pixels differ.
 */
export function paintDifference(
  canvas: HTMLCanvasElement,
  base: LensCapture,
  compared: LensCapture,
  view: DifferenceView,
): number {
  const doc = canvas.ownerDocument;
  const dpr = Math.max(base.dpr, compared.dpr);
  const a = pixelsOf(doc, base, dpr);
  const b = pixelsOf(doc, compared, dpr);
  if (!a || !b) return 0;
  const { image, changed } = diffPixels(a, b);
  const diff = doc.createElement('canvas');
  diff.width = image.width;
  diff.height = image.height;
  diff.getContext('2d')?.putImageData(image, 0, 0);

  const sd = doc.defaultView?.devicePixelRatio ?? 1;
  const width = Math.max(1, Math.round(view.size.width * sd));
  const height = Math.max(1, Math.round(view.size.height * sd));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return changed;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  const scale = (view.factor * sd) / dpr;
  const x = Math.round(width / 2 - base.at.x * view.factor * sd);
  const y = Math.round(height / 2 - base.at.y * view.factor * sd);
  ctx.drawImage(diff, x, y, image.width * scale, image.height * scale);
  return changed;
}
