import { mat3, type Rect } from '@weasel-js/geom';
import type { CommandPaint } from '@weasel-js/paint';
import {
  type ImageDrawCommand,
  SPRITE_STRIDE,
  type SpritesDrawCommand,
  getTexture,
  tileExtent,
} from '@weasel-js/renderer';
import { createPart } from '@weasel-js/registry';
import { foldPixels } from './color';
import { type DrawState, type PageCtx, pageFlip, skip } from './drawCommands';
import { affinePlaces, ContentStream } from './content';
import { name, type PdfDict, PdfReal, type PdfRef } from './objects';
import { paintToFrame } from './shading';
import type { RasterPixels } from './writePdf';

/** A texture paint as a draw command carries it, its units already resolved. */
export type TextureFill = Extract<CommandPaint, { kind: 'texture' }>;

type Source = ImageBitmap | HTMLImageElement;
type Sampling = 'linear' | 'nearest' | undefined;

let nextId = 0;
const idOf = createPart((_image: Source): number => ++nextId);
const embeddedIn = createPart((_objects: object) => new Map<string, PdfRef>());

function sizeOf(image: Source): { width: number; height: number } {
  const w = 'naturalWidth' in image ? image.naturalWidth : image.width;
  const h = 'naturalHeight' in image ? image.naturalHeight : image.height;
  return { width: w || 1, height: h || 1 };
}

function defaultReadPixels(image: Source): RasterPixels {
  const { width: w, height: h } = sizeOf(image);
  const ctx = new OffscreenCanvas(w, h).getContext('2d');
  if (!ctx) throw new Error('pdf: no 2D context to read image pixels with');
  ctx.drawImage(image, 0, 0);
  return { width: w, height: h, data: ctx.getImageData(0, 0, w, h).data };
}

/** Whether `px` is a bitmap PDF can hold: a whole number of pixels each way, at least one, and four bytes for each. */
export function fitsPixels(px: RasterPixels): boolean {
  const { width: w, height: h } = px;
  return Number.isSafeInteger(w) && Number.isSafeInteger(h) && w > 0 && h > 0 && px.data.length === w * h * 4;
}

/** A memo for this document: one entry per key, however many pages ask. */
function memo(ctx: PageCtx): Map<string, PdfRef> {
  return embeddedIn(ctx.objects);
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
  if (!fitsPixels(raw)) {
    skip(ctx, 'image has the wrong number of pixels');
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
    width: rect.width,
    height: rect.height,
    opacity,
  });
}

interface Place {
  x: number;
  y: number;
  width: number;
  height: number;
  source?: { x: number; y: number; width: number; height: number };
  flipX?: boolean;
  flipY?: boolean;
  opacity: number;
}

/** Draws one placement of `ref`, whose bitmap is `iw` by `ih` pixels, upright in the page's y-down frame. */
function place(ctx: PageCtx, ref: PdfRef, iw: number, ih: number, p: Place): void {
  const src = p.source ?? { x: 0, y: 0, width: iw, height: ih };
  if (!(src.width > 0 && src.height > 0 && p.width !== 0 && p.height !== 0)) return;
  const { out } = ctx;
  // Where the whole bitmap lands so that `src` fills the rect.
  const W = (iw * p.width) / src.width;
  const H = (ih * p.height) / src.height;
  const left = p.x - (src.x * p.width) / src.width;
  const top = p.y - (src.y * p.height) / src.height;
  const right = p.x + p.width + (src.x * p.width) / src.width;
  const bottom = p.y + p.height + (src.y * p.height) / src.height;
  const a = p.flipX ? -W : W;
  const e = p.flipX ? right : left;
  const d = p.flipY ? H : -H;
  const f = p.flipY ? bottom - H : top + H;

  out.op('q');
  if (p.opacity < 1) out.op('gs', `/${ctx.resources.extGState(p.opacity, p.opacity)}`);
  if (p.source) out.op('re', p.x, p.y, p.width, p.height).op('W').op('n');
  out.op('cm', a, 0, 0, d, e, f);
  out.op('Do', `/${ctx.resources.xobject(ref)}`);
  out.op('Q');
}

export function writeImage(ctx: PageCtx, cmd: ImageDrawCommand | SpritesDrawCommand, state: DrawState): void {
  const { width: iw, height: ih } = sizeOf(cmd.image);
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
      width: dw,
      height: dh,
      source: { x: sw < 0 ? sx + sw : sx, y: sh < 0 ? sy + sh : sy, width: Math.abs(sw), height: Math.abs(sh) },
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
  const entry = getTexture(paint.texture.id);
  if (!entry) return null;
  const toFrame = paintToFrame(ctx, paint, state);
  if (!toFrame) return null;
  const [a, b, c, d] = paint.transform ?? [1, 0, 0, 1];
  const o = paint.origin ?? { x: 0, y: 0 };
  const placement = mat3.fromAffine([a, b, c, d, o.x, o.y]);
  if (!mat3.invert(placement)) return null;
  // A pattern's matrix maps to the page's own space, below the flip that opens the content stream.
  const m = mat3.multiply(mat3.multiply(pageFlip(ctx), mat3.multiply(Float64Array.from(state.transform), toFrame)), placement);
  const [w, h] = tileExtent(paint, entry);
  // The tile is the unit square and the matrix scales it, so a tile of any size keeps its precision.
  const [ma, mb, mc, md, me, mf] = mat3.toAffine(m);
  const matrix = [ma * w, mb * w, mc * h, md * h, me, mf];

  const key = `pattern ${paint.texture.id} ${matrix.join(',')} ${state.colorMatrix?.join(',') ?? ''}`;
  const cache = memo(ctx);
  let ref = cache.get(key);
  if (!ref) {
    const image = imageXObject(ctx, entry.source, state, 'linear');
    if (!image) return null;
    ref = ctx.objects.alloc();
    const places = affinePlaces(matrix);
    ctx.objects.streamDeflated(
      ref,
      {
        Type: name('Pattern'),
        PatternType: 1,
        PaintType: 1,
        TilingType: 1,
        BBox: [0, 0, 1, 1],
        XStep: 1,
        YStep: 1,
        Matrix: matrix.map((v, i) => new PdfReal(v, places[i]!)),
        Resources: { XObject: { Im1: image } },
      },
      new ContentStream().op('cm', 1, 0, 0, -1, 0, 1).op('Do', '/Im1').bytes(),
    );
    cache.set(key, ref);
  }
  return ctx.resources.pattern(ref);
}
