/**
 * Reading a presented canvas back: the one readback a loupe, an eyedropper or
 * anything else showing the canvas's own pixels goes through.
 */
import { clamp } from '@weasel-js/geom';
import { layoutBoxOf } from '@weasel-js/routing';
import { canvasPaintsWith } from './canvasBackend';
import { readCanvasPixels } from './readCanvasPixels';

type Rect = { x: number; y: number; width: number; height: number };

/**
 * The `rw × rh` device-pixel rect centered on `pointer`, top-left origin.
 * `pointer` is in CSS px relative to `target`, the rect of the buffer the
 * canvas paints into (device px), and the rect is clamped inside it.
 */
export function regionAround(target: Rect, pointer: { x: number; y: number }, dpr: number, rw: number, rh: number): Rect {
  const cx = target.x + Math.round(pointer.x * dpr);
  const cy = target.y + Math.round(pointer.y * dpr);
  return {
    x: clamp(cx - Math.floor(rw / 2), target.x, target.x + Math.max(0, target.width - rw)),
    y: clamp(cy - Math.floor(rh / 2), target.y, target.y + Math.max(0, target.height - rh)),
    width: rw,
    height: rh,
  };
}

/** The device-px rect around `at` on `canvas`, sized for its pixel ratio and
 *  clamped inside `region`, its painted rect in CSS px (default: all of it);
 *  null while it has no layout box. */
export function regionOnCanvas(
  canvas: HTMLCanvasElement, region: Rect | undefined, at: { x: number; y: number },
  rw: (dpr: number) => number, rh: (dpr: number) => number,
): Rect | null {
  // Its CSS size, which `region` is in: an ancestor transform changes the client rect and not the buffer.
  const css = layoutBoxOf(canvas);
  if (css.width === 0) return null;
  const dpr = canvas.width / css.width;
  const target = region
    ? {
        x: Math.round(region.x * dpr), y: Math.round(region.y * dpr),
        width: Math.round(region.width * dpr), height: Math.round(region.height * dpr),
      }
    : { x: 0, y: 0, width: canvas.width, height: canvas.height };
  return regionAround(target, at, dpr, rw(dpr), rh(dpr));
}

/** `rect` of the drawing buffer, top-down and premultiplied as the buffer
 *  holds it. GL reports rows bottom-up, so both the read origin and the rows
 *  are flipped. */
export function readGl(gl: WebGL2RenderingContext, bufferHeight: number, rect: Rect): ImageData {
  const raw = new Uint8Array(rect.width * rect.height * 4);
  gl.readPixels(rect.x, bufferHeight - rect.y - rect.height, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
  const flipped = new Uint8ClampedArray(raw.length);
  const stride = rect.width * 4;
  for (let row = 0; row < rect.height; row++) {
    flipped.set(raw.subarray((rect.height - 1 - row) * stride, (rect.height - row) * stride), row * stride);
  }
  return new ImageData(flipped, rect.width, rect.height);
}

/** What {@link createCanvasReader} answers with. */
export interface CanvasReader {
  /** `rect`'s pixels, top-down and premultiplied, or null when the canvas cannot answer. */
  region(rect: Rect): ImageData | Promise<ImageData> | null;
  /** The RGBA of the pixel at `rect`'s corner, read at once or from the last region read. */
  pixel(rect: Rect): ArrayLike<number> | null;
}

/**
 * Reads `canvas` back: at once on WebGL, and on WebGPU, which reads back only
 * asynchronously, through `readCanvasPixels`, keeping the last region read so
 * a pixel inside it is answered at once. Device px from the canvas's top-left.
 */
export function createCanvasReader(canvas: HTMLCanvasElement): CanvasReader {
  let last: { rect: Rect; data: ImageData } | null = null;
  const now = (rect: Rect): ImageData | null => {
    if (canvasPaintsWith(canvas) === 'webgpu') return null;
    const gl = canvas.getContext('webgl2');
    return gl ? readGl(gl, canvas.height, rect) : null;
  };
  return {
    region(rect: Rect): ImageData | Promise<ImageData> | null {
      const sync = now(rect);
      if (sync || canvasPaintsWith(canvas) !== 'webgpu') return sync;
      return readCanvasPixels(canvas, rect)?.then((bytes) => {
        const data = new ImageData(new Uint8ClampedArray(bytes), rect.width, rect.height);
        last = { rect, data };
        return data;
      }) ?? null;
    },
    pixel(rect: Rect): ArrayLike<number> | null {
      if (canvasPaintsWith(canvas) !== 'webgpu') return now({ ...rect, width: 1, height: 1 })?.data ?? null;
      if (!last) return null;
      const dx = rect.x - last.rect.x;
      const dy = rect.y - last.rect.y;
      if (dx < 0 || dy < 0 || dx >= last.rect.width || dy >= last.rect.height) return null;
      const i = (dy * last.rect.width + dx) * 4;
      return last.data.data.subarray(i, i + 4);
    },
  };
}
