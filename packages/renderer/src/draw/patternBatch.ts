import type { TexturePaint } from '@weasel-js/paint';
import type { Mesh } from '@weasel-js/geom/tessellate';
import { mat3 } from '@weasel-js/geom';
import type { GradientUV } from '../drawBatch';
import { PAINT_MODE_IMAGE, withMatrix } from '../shaders/batchFill';
import { getTexture, type TextureEntry } from '../textures/registerTexture';
import { patternTileSpace } from '../math/patternSpace';
import type { DrawContext } from './drawContext';
import { retryUncut } from './clip';
import { flushBatch } from './flushBatch';
import { openRun, runTakes, slotForAtlas, takeHulls, takeMatrix } from './batchRun';
import { gradientSpaceInverse } from './gradient';
import { texturedUnder } from './foldColor';

/** A pattern a run can carry: its tile coordinate, in tiles, affine in the
 *  coordinates the geometry arrives in. */
export interface PatternBatchPaint {
  kind: 'pattern';
  id: string;
  source: TextureEntry['source'];
  opacity: number;
  uv: GradientUV;
}

/** A color page and a pattern tile have no distance field, so nothing reads
 *  their slot's scale. */
const NO_FIELD = [0, 0] as const;

/**
 * `fill` as a run's vertices carry it, `null` when its tile has no inverse
 * (it draws nothing, as `bindPattern` does), and `undefined` for a texture the
 * registry does not hold, which `bindPattern` warns about.
 *
 * The pattern program recovers the tile coordinate per fragment from the
 * screen position; the coordinate is affine in that position, so a vertex can
 * carry it and the rasterizer's interpolation is exact. The texture is
 * uploaded to repeat, which tiles a coordinate past 0..1 at the sampler.
 */
export function patternBatchPaint(
  ctx: DrawContext, fill: TexturePaint,
): PatternBatchPaint | undefined | null {
  const entry = getTexture(fill.texture.id);
  if (!entry) return undefined;
  const inverse = gradientSpaceInverse(ctx, fill.units);
  const tileSpace = inverse && patternTileSpace(inverse, fill.origin ?? { x: 0, y: 0 }, fill.transform);
  if (!tileSpace) return null;
  const g = mat3.multiply(tileSpace, ctx.state.transform);
  const [tw, th] = tileExtent(fill, entry);
  return {
    kind: 'pattern', id: fill.texture.id, source: entry.source, opacity: fill.opacity ?? 1,
    uv: {
      ux: g[0] / tw, uy: g[3] / tw, u0: g[6] / tw,
      vx: g[1] / th, vy: g[4] / th, v0: g[7] / th,
    },
  };
}

/** Tile extent in paint-space units — one tile spans this many units of
 *  whatever space `units` names. A side the paint leaves out is the size the
 *  texture stands for, else its pixel size. */
export function tileExtent(fill: TexturePaint, { source, size }: TextureEntry): [number, number] {
  const w = fill.width ?? size?.width ?? ('naturalWidth' in source ? source.naturalWidth : source.width);
  const h = fill.height ?? size?.height ?? ('naturalHeight' in source ? source.naturalHeight : source.height);
  return [w > 0 ? w : 1, h > 0 ? h : 1];
}

/**
 * Open or continue a run for `vertices` more of pattern-filled geometry,
 * flushing first if the run would overflow, has no slot for the tile, or holds
 * it already and the registry has since replaced its pixels: the upload
 * rewrites the one texture both would sample.
 */
function stagePattern(
  ctx: DrawContext, paint: PatternBatchPaint, vertices: number,
): { slot: number; tint: readonly [number, number, number, number] } {
  const under = texturedUnder(ctx, false);
  const open = ctx.batchState;
  if (open !== undefined
      && (!runTakes(ctx, open, under.colorMatrix, under.alpha)
          || slotForAtlas(open, paint.id) < 0
          || (slotForAtlas(open, paint.id) <= open.textures.length
              && ctx.textureCache.replaces(paint.id, paint.source)))) {
    flushBatch(ctx);
  }
  if (ctx.drawBatch.wouldOverflow(vertices)) flushBatch(ctx);
  ctx.textureCache.uploadRegistered(paint.id, paint.source, 'repeat');
  const staged = openRun(ctx);
  let slot = slotForAtlas(staged, paint.id);
  if (slot > staged.textures.length) {
    staged.textures.push({ kind: 'atlas', id: paint.id, fieldScale: NO_FIELD });
    slot = staged.textures.length;
  }
  under.slot = takeHulls(ctx, staged, withMatrix(slot, takeMatrix(staged, under.colorMatrix, under.alpha)));
  return under;
}

/**
 * `uv` less the whole tiles it has reached at `(x, y)`. The tile repeats, so
 * they change nothing sampled, and far from the origin a float32 coordinate
 * has no bits left for the texel without taking them out in doubles.
 */
function nearTile(uv: GradientUV, x: number, y: number): GradientUV {
  return {
    ...uv,
    u0: uv.u0 - Math.floor(uv.ux * x + uv.uy * y + uv.u0),
    v0: uv.v0 - Math.floor(uv.vx * x + uv.vy * y + uv.v0),
  };
}

export function pushPatternRect(
  ctx: DrawContext,
  rect: { x: number; y: number; width: number; height: number },
  paint: PatternBatchPaint,
): void {
  const { slot, tint } = stagePattern(ctx, paint, 4);
  // White vertices but for the tint; the opacity and group alpha ride
  // `a_post`, after the matrix, as an image quad's do.
  if (!ctx.drawBatch.pushGradientRect(
    rect.x, rect.y, rect.width, rect.height, ctx.state.transform,
    nearTile(paint.uv, rect.x, rect.y), paint.opacity * tint[3], slot, PAINT_MODE_IMAGE,
    tint[0], tint[1], tint[2], 1,
  )) retryUncut(ctx, rect, paint, pushPatternRect);
}

export function pushPatternMesh(ctx: DrawContext, mesh: Mesh, paint: PatternBatchPaint): void {
  const { slot, tint } = stagePattern(ctx, paint, mesh.vertices.length >> 1);
  const at = mesh.vertices.length > 0
    ? { x: mesh.vertices[0] + (mesh.origin?.x ?? 0), y: mesh.vertices[1] + (mesh.origin?.y ?? 0) }
    : { x: 0, y: 0 };
  if (!ctx.drawBatch.pushGradientMesh(
    mesh, ctx.state.transform,
    nearTile(paint.uv, at.x, at.y), paint.opacity * tint[3], slot, PAINT_MODE_IMAGE,
    tint[0], tint[1], tint[2], 1,
  )) retryUncut(ctx, mesh, paint, pushPatternMesh);
}
