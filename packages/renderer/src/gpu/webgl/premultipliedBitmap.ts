/**
 * WebGL uploads an `ImageBitmap` as it holds its texels and ignores
 * `UNPACK_PREMULTIPLY_ALPHA_WEBGL`, and nothing reports whether a bitmap holds
 * them straight (`premultiplyAlpha: 'none'`) or premultiplied. A 2D canvas
 * knows, and draws either kind premultiplied, and a canvas upload honors the
 * flag: so a bitmap bound for a premultiplied texture goes through one.
 */
import type { GpuImageSource } from '../types';

type Scratch = OffscreenCanvas | HTMLCanvasElement;

let scratch: { canvas: Scratch; ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D } | null | undefined;

function scratchCanvas(): typeof scratch {
  if (scratch !== undefined) return scratch;
  const canvas: Scratch | null = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(1, 1)
    : typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const ctx = canvas?.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  scratch = canvas && ctx ? { canvas, ctx } : null;
  return scratch;
}

/**
 * Hand `upload` a source whose texels, uploaded under
 * `UNPACK_PREMULTIPLY_ALPHA_WEBGL`, come out premultiplied: an `ImageBitmap`
 * drawn into a scratch 2D canvas, anything else as it is. The canvas is
 * shrunk again once `upload` returns, so it holds no image's pixels between
 * uploads.
 */
export function withPremultipliedSource(source: GpuImageSource, upload: (source: TexImageSource) => void): void {
  const s = typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap ? scratchCanvas() : null;
  if (!s) {
    upload(source);
    return;
  }
  const { canvas, ctx } = s;
  canvas.width = source.width;
  canvas.height = source.height;
  ctx.drawImage(source as ImageBitmap, 0, 0);
  try {
    upload(canvas);
  } finally {
    canvas.width = canvas.height = 1;
  }
}
