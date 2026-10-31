import { type ImageDrawCommand, type SpritesDrawCommand, SPRITE_STRIDE } from '../DrawCommand';
import type { ClipRect } from '../batchClip';
import type { DrawContext } from './drawContext';
import { enterUncut, leaveUncut, retryUncut } from './clip';
import { flushBatch } from './flushBatch';
import { stageImage } from './batch';

/**
 * Stage one image quad. Nothing reaches the GPU here — `flushBatch` draws the
 * run this joins.
 *
 * The upload has to happen now rather than at flush: a run is keyed on bitmap
 * identity, and `flushBatch` binds a texture it assumes already exists.
 */
/** Texels per device pixel at which a mipmap starts to beat one bilinear tap. */
const MINIFIED = 2;

/**
 * How many device pixels a group unit covers on each axis, squared and scaled
 * by {@link MINIFIED}: a quad is minified on x when
 * `sourceWidth² ≥ limit[0] * drawnWidth²`.
 */
function minifiedLimits(ctx: DrawContext): [number, number] {
  const m = ctx.state.transform;
  const dpr = ctx.deviceWidth && ctx.widthCss ? ctx.deviceWidth / ctx.widthCss : 1;
  const k = (MINIFIED * dpr) ** 2;
  return [k * (m[0] * m[0] + m[1] * m[1]), k * (m[3] * m[3] + m[4] * m[4])];
}

const isMinified = (limit: [number, number], sw: number, sh: number, dw: number, dh: number): boolean =>
  sw * sw >= limit[0] * dw * dw || sh * sh >= limit[1] * dh * dh;

/** Whether a draw samples all of `image`, so mipmaps cannot pull in texels
 *  from outside what it shows. */
const drawsWhole = (image: ImageBitmap, src: ImageDrawCommand['source']): boolean =>
  !src || (src.x <= 0 && src.y <= 0 && src.x + src.w >= image.width && src.y + src.h >= image.height);

export function drawImage(ctx: DrawContext, cmd: ImageDrawCommand): void {
  ctx.imageCache.upload(cmd.image, cmd.image);
  const whole = drawsWhole(cmd.image, cmd.source);
  if (whole && ctx.imageCache.lacksMipmaps(cmd.image)
      && isMinified(minifiedLimits(ctx), cmd.image.width, cmd.image.height, cmd.w, cmd.h)) {
    ctx.imageCache.buildMipmaps(cmd.image);
  }
  // Without mipmaps a whole draw samples as a sub-rect one does, so it stays in their run.
  const mips = whole && ctx.imageCache.hasMipmaps(cmd.image);
  const { slot, tint } = stageImage(ctx, cmd.image, cmd.sampling ?? 'linear', mips);

  // Sampling window: the whole bitmap unless `source` narrows it, with the
  // flips applied by swapping the ends rather than moving the quad.
  const src = cmd.source;
  let u0 = 0, v0 = 0, u1 = 1, v1 = 1;
  if (src) {
    const tw = cmd.image.width, th = cmd.image.height;
    u0 = src.x / tw; u1 = (src.x + src.w) / tw;
    v0 = src.y / th; v1 = (src.y + src.h) / th;
  }
  if (cmd.flipX) { const t = u0; u0 = u1; u1 = t; }
  if (cmd.flipY) { const t = v0; v0 = v1; v1 = t; }

  if (!ctx.drawBatch.pushQuad(
    cmd.x, cmd.y, cmd.w, cmd.h, ctx.state.transform,
    u0, v0, u1, v1,
    // Group alpha rides here with the opacity, in the tint's fourth channel.
    (cmd.opacity ?? 1) * tint[3],
    slot, tint[0], tint[1], tint[2],
  )) retryUncut(ctx, cmd, undefined, drawImage);
}

/**
 * Stage a packed run of sprites. The same staging `drawImage` does, minus a
 * command object per quad — see `SpritesDrawCommand`.
 *
 * The run is opened once and reopened only when the per-flush cap forces a
 * chunk, so the state check that costs a command its own run happens twice in
 * a frame rather than twenty thousand times.
 */
export function drawSprites(ctx: DrawContext, cmd: SpritesDrawCommand): void {
  const data = cmd.sprites;
  const count = Math.floor(data.length / SPRITE_STRIDE);
  if (count === 0) return;

  ctx.imageCache.upload(cmd.image, cmd.image);
  const sampling = cmd.sampling ?? 'linear';
  // Sprites sample cells of a sheet, which mipmaps would blend with their neighbors.
  const stage = () => stageImage(ctx, cmd.image, sampling, false);
  let { slot, tint } = stage();

  const batch = ctx.drawBatch;
  const m = ctx.state.transform;
  const tw = cmd.image.width;
  const th = cmd.image.height;

  for (let s = 0, i = 0; s < count; s++, i += SPRITE_STRIDE) {
    if (batch.wouldOverflow(4)) {
      flushBatch(ctx);
      ({ slot, tint } = stage());
    }
    const sx = data[i + 4], sy = data[i + 5], sw = data[i + 6], sh = data[i + 7];
    let cut: ClipRect | null | undefined;
    while (!batch.pushQuad(
      data[i], data[i + 1], data[i + 2], data[i + 3], m,
      sx / tw, sy / th, (sx + sw) / tw, (sy + sh) / th,
      data[i + 8] * tint[3], slot, tint[0], tint[1], tint[2],
    )) {
      cut = enterUncut(ctx);
      ({ slot, tint } = stage());
    }
    if (cut !== undefined) {
      leaveUncut(ctx, cut);
      ({ slot, tint } = stage());
    }
  }
}
