import { mat3 } from '@weasel-js/geom';
import type { CommandPaint } from '@weasel-js/paint';
import {
  type ImageDrawCommand,
  SPRITE_STRIDE,
  type SpritesDrawCommand,
  textureRegistry,
} from '@weasel-js/renderer';
import { foldPixels } from './color';
import { type DrawState, type PageCtx, pageFlip, skip } from './drawCommands';
import { latin1Bytes } from './latin1';
import { name, type PdfDict, type PdfRef } from './objects';
import { paintToFrame } from './shading';
import type { RasterPixels, Rect } from './writePdf';

/** A texture paint as a draw command carries it, its units already resolved. */
export type TextureFill = Extract<CommandPaint, { kind: 'texture' }>;

type Source = ImageBitmap | HTMLImageElement;
type Sampling = 'linear' | 'nearest' | undefined;

const ids = new WeakMap<object, number>();
const embedded = new WeakMap<object, Map<string, PdfRef>>();
let nextId = 0;

function sizeOf(image: Source): { w: number; h: number } {
  const w = 'naturalWidth' in image ? image.naturalWidth : image.width;
  const h = 'naturalHeight' in image ? image.naturalHeight : image.height;
  return { w: w || 1, h: h || 1 };
}

function defaultReadPixels(image: Source): RasterPixels {
  const { w, h } = sizeOf(image);
  const ctx = new OffscreenCanvas(w, h).getContext('2d');
  if (!ctx) throw new Error('pdf: no 2D context to read image pixels with');
  ctx.drawImage(image, 0, 0);
  return { width: w, height: h, data: ctx.getImageData(0, 0, w, h).data };
}

/** A memo for this document: one entry per key, however many pages ask. */
function memo(ctx: PageCtx): Map<string, PdfRef> {
  let m = embedded.get(ctx.objects);
  if (!m) embedded.set(ctx.objects, (m = new Map()));
  return m;
}

function idOf(image: Source): number {
  let id = ids.get(image);
  if (id === undefined) ids.set(image, (id = ++nextId));
  return id;
}

function imageObject(ctx: PageCtx, dict: PdfDict, data: Uint8Array): PdfRef {
  const ref = ctx.objects.alloc();
  ctx.objects.streamDeflated(ref, { Type: name('XObject'), Subtype: name('Image'), ...dict }, data);
  return ref;
}

/**
 * The image as an XObject, with its alpha as an SMask when any pixel is translucent.
 * Memoized per image, sampling and color matrix across the whole document.
 */
export function imageXObject(
  ctx: PageCtx,
  image: Source,
  state: DrawState = { transform: mat3.identity(), alpha: 1, colorMatrix: null },
  sampling: Sampling = 'linear',
): PdfRef | null {
  const interpolate = sampling !== 'nearest';
  const key = `${idOf(image)} ${interpolate} ${state.colorMatrix?.join(',') ?? ''}`;
  const cache = memo(ctx);
  const hit = cache.get(key);
  if (hit) return hit;

  let raw: RasterPixels;
  try {
    raw = (ctx.opts.readPixels ?? defaultReadPixels)(image);
  } catch {
    skip(ctx, 'image could not be read');
    return null;
  }
  const ref = pixelsXObject(ctx, { ...raw, data: foldPixels(raw.data, state) }, interpolate);
  cache.set(key, ref);
  return ref;
}

/** Straight top-down RGBA as an image XObject, with its alpha as an SMask when any pixel is translucent. */
function pixelsXObject(ctx: PageCtx, raw: RasterPixels, interpolate: boolean): PdfRef {
  const rgba = raw.data;
  const n = raw.width * raw.height;
  const rgb = new Uint8Array(n * 3);
  const alpha = new Uint8Array(n);
  let translucent = false;
  for (let i = 0; i < n; i++) {
    rgb[i * 3] = rgba[i * 4];
    rgb[i * 3 + 1] = rgba[i * 4 + 1];
    rgb[i * 3 + 2] = rgba[i * 4 + 2];
    alpha[i] = rgba[i * 4 + 3];
    if (alpha[i] < 255) translucent = true;
  }
  const dims = (space: string): PdfDict => ({
    Width: raw.width,
    Height: raw.height,
    ColorSpace: name(space),
    BitsPerComponent: 8,
    Interpolate: interpolate,
  });
  const mask = translucent ? imageObject(ctx, dims('DeviceGray'), alpha) : undefined;
  return imageObject(ctx, { ...dims('DeviceRGB'), SMask: mask }, rgb);
}

/** Draws rasterized pixels over `rect`, given in the page's y-down frame. */
export function writeRaster(ctx: PageCtx, raw: RasterPixels, rect: Rect, opacity: number): void {
  place(ctx, pixelsXObject(ctx, raw, true), raw.width, raw.height, {
    x: rect.x,
    y: rect.y,
    w: rect.width,
    h: rect.height,
    opacity,
  });
}

interface Place {
  x: number;
  y: number;
  w: number;
  h: number;
  source?: { x: number; y: number; w: number; h: number };
  flipX?: boolean;
  flipY?: boolean;
  opacity: number;
}

/** Draws one placement of `ref`, whose bitmap is `iw` by `ih` pixels, upright in the page's y-down frame. */
function place(ctx: PageCtx, ref: PdfRef, iw: number, ih: number, p: Place): void {
  const src = p.source ?? { x: 0, y: 0, w: iw, h: ih };
  if (!(src.w > 0 && src.h > 0 && p.w !== 0 && p.h !== 0)) return;
  const { out } = ctx;
  // Where the whole bitmap lands so that `src` fills the rect.
  const W = (iw * p.w) / src.w;
  const H = (ih * p.h) / src.h;
  const left = p.x - (src.x * p.w) / src.w;
  const top = p.y - (src.y * p.h) / src.h;
  const right = p.x + p.w + (src.x * p.w) / src.w;
  const bottom = p.y + p.h + (src.y * p.h) / src.h;
  const a = p.flipX ? -W : W;
  const e = p.flipX ? right : left;
  const d = p.flipY ? H : -H;
  const f = p.flipY ? bottom - H : top + H;

  out.op('q');
  if (p.opacity < 1) out.op('gs', `/${ctx.resources.extGState(p.opacity, p.opacity)}`);
  if (p.source) out.op('re', p.x, p.y, p.w, p.h).op('W').op('n');
  out.op('cm', a, 0, 0, d, e, f);
  out.op('Do', `/${ctx.resources.xobject(ref)}`);
  out.op('Q');
}

export function writeImage(ctx: PageCtx, cmd: ImageDrawCommand | SpritesDrawCommand, state: DrawState): void {
  const { w: iw, h: ih } = sizeOf(cmd.image);
  const ref = imageXObject(ctx, cmd.image, state, cmd.sampling);
  if (!ref) return;
  if (cmd.kind === 'image') {
    place(ctx, ref, iw, ih, { ...cmd, opacity: (cmd.opacity ?? 1) * state.alpha });
    return;
  }
  const s = cmd.sprites;
  for (let i = 0; i + SPRITE_STRIDE <= s.length; i += SPRITE_STRIDE) {
    const [dx, dy, dw, dh, sx, sy, sw, sh, opacity] = s.subarray(i, i + SPRITE_STRIDE);
    place(ctx, ref, iw, ih, {
      x: dx,
      y: dy,
      w: dw,
      h: dh,
      source: { x: sw < 0 ? sx + sw : sx, y: sh < 0 ? sy + sh : sy, w: Math.abs(sw), h: Math.abs(sh) },
      flipX: sw < 0,
      flipY: sh < 0,
      opacity: opacity * state.alpha,
    });
  }
}

/**
 * The tiling pattern a texture paint names, as a resource name for `scn`; `null` when the
 * texture is not registered or its placement has no inverse, which paints nothing.
 */
export function texturePattern(ctx: PageCtx, paint: TextureFill, state: DrawState): string | null {
  const entry = textureRegistry.get(paint.texture.id);
  if (!entry) return null;
  const toFrame = paintToFrame(ctx, paint, state);
  if (!toFrame) return null;
  const [a, b, c, d] = paint.transform ?? [1, 0, 0, 1];
  const o = paint.origin ?? { x: 0, y: 0 };
  const placement = mat3.fromAffine([a, b, c, d, o.x, o.y]);
  if (!mat3.invert(placement)) return null;
  // A pattern's matrix maps to the page's own space, below the flip that opens the content stream.
  const m = mat3.multiply(mat3.multiply(pageFlip(ctx), mat3.multiply(Float64Array.from(state.transform), toFrame)), placement);
  const matrix = mat3.toAffine(m);

  const key = `pattern ${paint.texture.id} ${matrix.join(',')} ${state.colorMatrix?.join(',') ?? ''}`;
  const cache = memo(ctx);
  let ref = cache.get(key);
  if (!ref) {
    const { w, h } = sizeOf(entry.source);
    const image = imageXObject(ctx, entry.source, state, 'linear');
    if (!image) return null;
    ref = ctx.objects.alloc();
    ctx.objects.streamDeflated(
      ref,
      {
        Type: name('Pattern'),
        PatternType: 1,
        PaintType: 1,
        TilingType: 1,
        BBox: [0, 0, w, h],
        XStep: w,
        YStep: h,
        Matrix: matrix,
        Resources: { XObject: { Im1: image } },
      },
      latin1Bytes(`${w} 0 0 -${h} 0 ${h} cm\n/Im1 Do\n`),
    );
    cache.set(key, ref);
  }
  return ctx.resources.pattern(ref);
}
