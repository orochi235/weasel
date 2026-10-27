import type { Paint, TexturePaint } from '@weasel-js/paint';
import { type LaidOutGroup, type LaidOutDecoration, type PaintRunsOpts, cachedPaintRuns } from '@weasel-js/text';
import { laidOutText } from '../textLayout';
import type { TextDrawCommand } from '../DrawCommand';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import type { GlMat3 } from '@weasel-js/geom';
import type { Mesh } from '@weasel-js/geom/tessellate';
import { isSolidPaint, resolveColor } from '@weasel-js/paint';
import {
  ensureFontTexture,
  textureCacheKey,
  syncDynamicPageTexture,
  dynamicPageTextureId,
  GLYPH_MODE_MSDF,
  GLYPH_MODE_R8,
  glyphFieldScale,
  SYNTH_BOLD_AMOUNT,
} from '@weasel-js/font';
import { outlineGroupMesh, outlineGroupStrokeMesh } from '../glyphOutlineMesh';
import type { ClipRect } from '../batchClip';
import { QUAD_STRIDE, SYNTHETIC_ITALIC_RADIANS } from '@weasel-js/text';
import type { DrawContext, GlyphPaintKind } from './drawContext';
import { drawTriangles } from './drawTriangles';
import { drawColorGlyphs } from './colorGlyphs';
import { modelScale } from './modelScale';
import { applyClipTest } from './stencil';
import { enterUncut, leaveUncut, flushForOwnDraw } from './clip';
import { BATCH_MODEL, flushBatch } from './flushBatch';
import { solidColor, stageSolid, stageGlyphs, tryStageFill } from './batch';
import { foldColor, foldColorInto } from './foldColor';
import { batchPaint } from './gradient';
import { bindPattern, bindGradient } from './paintBind';
import { drawPathFillByKind } from './pathPaint';
import { type ScreenRect, renderPaintToScratch, bindScratchPaint } from './scratchPass';

/**
 * On-screen glyph size (CSS px) at or above which a face with registered
 * outlines is drawn as geometry instead of sampled from a distance field.
 *
 * 48 is the dynamic tier's own `BAKE_SIZE`, which makes it the size at which
 * that tier stops being an interpolation and starts being a magnification:
 * `glyphRasterizer.ts` measures coverage error bottoming out *at* the bake
 * size and rising on both sides, and past a few times it the reconstructed
 * field shows the raster as contour wobble. The same number is a safe
 * crossing for the baked MSDF atlas, which is still crisp here — outlines are
 * exact, so switching early costs nothing but the tessellation, and the
 * hinting the atlas has and outlines don't stopped mattering well below this.
 */
export const OUTLINE_MIN_SCREEN_PX = 48;

/** Refilled per command: `cachedPaintRuns` reads it and keeps nothing of it. */
const paintOpts: PaintRunsOpts = { outlineMinSize: undefined };

export function drawText(ctx: DrawContext, cmd: TextDrawCommand): void {
  // Screen threshold → world threshold: a 12px label at 8× zoom is 96 screen
  // pixels of text and wants outlines exactly as much as a 96px heading does.
  const minScreen = ctx.textOutlineMinScreenSize ?? OUTLINE_MIN_SCREEN_PX;
  const outlineMinSize = Number.isFinite(minScreen)
    ? minScreen / modelScale(ctx.state.transform)
    : undefined;

  const { laid, dx, dy } = laidOutText(cmd);
  paintOpts.outlineMinSize = outlineMinSize;
  const { groups, decorations } = cachedPaintRuns(laid, cmd.runs, paintOpts);
  // Decorations are checked too: text whose glyphs are all ink-free — every
  // one still awaiting a dynamic-atlas bake, say — produces no groups at all
  // while still carrying a rule that has to be drawn.
  if (groups.length === 0 && decorations.length === 0) return;

  for (const group of groups) {
    if (group.source === 'outline') drawTextOutlineGroup(ctx, group, dx, dy);
    else if (group.source === 'color') drawColorGlyphs(ctx, group, dx, dy);
    else drawTextGroup(ctx, group, dx, dy);
  }

  drawTextDecorations(ctx, decorations, dx, dy);
}

/**
 * Paint one group of tessellated glyph outlines as a single mesh: cached
 * em-space triangles are transformed on the CPU into world space and appended
 * to one buffer, so a paragraph set in one face and color is one draw call
 * rather than one per glyph.
 */
function drawTextOutlineGroup(ctx: DrawContext, group: LaidOutGroup, dx: number, dy: number): void {
  const fill = group.fill?.paint;
  if (fill !== undefined) {
    const mesh = outlineGroupMesh(group, dx, dy);
    if (mesh) drawOutlineMesh(ctx, fill, mesh);
  }

  // Stroke after fill — Canvas2D's fillText-then-strokeText convention, and
  // SVG's default paint-order. A second batched draw call over the same
  // group, not a call per glyph.
  const strokePaint = group.stroke?.paint;
  if (!strokePaint) return;
  const ribbon = outlineGroupStrokeMesh(group, dx, dy, ctx.state.transform);
  if (ribbon) drawOutlineMesh(ctx, strokePaint, ribbon);
}

/**
 * Paint one merged glyph-outline mesh, staging it where it fits. A paragraph
 * can mix tiers — a heading drawn as outlines and a caption drawn from the
 * atlas are groups of one command — and an outline that painted itself while
 * glyphs sat staged behind it would come out under them.
 */
function drawOutlineMesh(ctx: DrawContext, fill: Paint, mesh: Mesh): void {
  const paint = batchPaint(ctx, fill, false);
  if (paint === null) return;
  if (tryStageFill(ctx, mesh, paint)) return;
  drawPathFillByKind(ctx, fill, ctx.meshCache.uploadTransient(mesh));
}

/**
 * Stage the rules an underline, strikethrough or overline asks for.
 *
 * Color resolution matches `drawTextGroup` exactly, `fill.opacity` included,
 * so a rule can never disagree with the glyphs it underlines. They stage as
 * ordinary rects, which is what keeps them in the run their glyphs are in. A
 * rule under a texture paint is geometry under it, the way an outline glyph is.
 */
function drawTextDecorations(
  ctx: DrawContext, decorations: readonly LaidOutDecoration[], dx: number, dy: number,
): void {
  for (const d of decorations) {
    const paint = d.fill.paint;
    if (paint === undefined) continue;
    if (glyphPaintKindOf(paint) !== null) {
      drawOutlineMesh(ctx, paint, ruleMesh(d.x0 + dx, d.y0 + dy, d.x1 + dx, d.y1 + dy));
      continue;
    }
    const [r, g, b, a] = isSolidPaint(paint) ? solidColor(paint) : [0, 0, 0, 1];
    let cut: ClipRect | null | undefined;
    for (;;) {
      const slot = stageSolid(ctx, 4);
      const rgba = foldColor(ctx, r, g, b, a);
      if (ctx.drawBatch.pushRect(
        d.x0 + dx, d.y0 + dy, d.x1 - d.x0, d.y1 - d.y0, ctx.state.transform,
        rgba[0], rgba[1], rgba[2], rgba[3], slot,
      )) break;
      cut = enterUncut(ctx);
    }
    if (cut !== undefined) leaveUncut(ctx, cut);
  }
}

function ruleMesh(x0: number, y0: number, x1: number, y1: number): Mesh {
  return {
    vertices: new Float32Array([x0, y0, x1, y0, x1, y1, x0, y1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}

/**
 * Stage one group of atlas glyphs into the batch.
 *
 * The text color and the atlas (a slot index packed with the paint mode) ride
 * the vertices, so a run off a baked MSDF atlas and one off the runtime canvas
 * bake belong to the same draw, and so does whatever else the page put around
 * them. The synthetic-bold threshold rides them too, and the synthetic
 * oblique is sheared into the corners as `pushGlyph` places them.
 */
function drawTextGroup(
  ctx: DrawContext, group: LaidOutGroup, dx: number, dy: number,
): void {
  if (group.source === 'canvas') {
    if (!syncDynamicPageTexture(ctx.textureCache, group.page)) return;
  } else {
    if (!ensureFontTexture(group.family, group.weight, group.style, ctx.textureCache)) return;
  }
  if (group.quadData.length === 0) return;

  const atlasId = group.source === 'canvas'
    ? dynamicPageTextureId(group.page)
    : textureCacheKey(group.family, group.weight, group.style);
  const mode = group.source === 'canvas' ? GLYPH_MODE_R8 : GLYPH_MODE_MSDF;
  const fieldScale = glyphFieldScale(
    group.source === 'canvas' ? 'canvas' : 'atlas', group.family, group.weight, group.style,
  );
  if (!fieldScale) return;
  const bold = group.synthetic.bold ? SYNTH_BOLD_AMOUNT : 0;
  const tanItalic = group.synthetic.italic ? Math.tan(SYNTHETIC_ITALIC_RADIANS) : 0;
  const fill = group.fill?.paint;
  if (fill === undefined) return;
  const paintKind = glyphPaintKindOf(fill);
  if (paintKind !== null) {
    drawPaintedGlyphs(ctx, group, dx, dy, paintKind, atlasId, mode, bold, tanItalic, fieldScale);
    return;
  }
  const color = isSolidPaint(fill) ? resolveColor(fill.color) : BLACK;
  const opacity = isSolidPaint(fill) ? fill.opacity ?? 1 : 1;

  const batch = ctx.drawBatch;
  const m = ctx.state.transform;
  let slot = stageGlyphs(ctx, atlasId, fieldScale);
  const rgba = foldColorInto(ctx, color[0], color[1], color[2], color[3] * opacity, glyphRgba);

  const quads = group.quadData;
  for (let at = 0; at < quads.length; at += QUAD_STRIDE) {
    if (batch.wouldOverflow(4)) {
      flushBatch(ctx);
      slot = stageGlyphs(ctx, atlasId, fieldScale);
    }
    let cut: ClipRect | null | undefined;
    while (!batch.pushGlyph(quads, at, dx, dy, tanItalic, m, rgba, slot, mode, bold)) {
      cut = enterUncut(ctx);
      slot = stageGlyphs(ctx, atlasId, fieldScale);
    }
    if (cut !== undefined) {
      leaveUncut(ctx, cut);
      slot = stageGlyphs(ctx, atlasId, fieldScale);
    }
  }
}

const BLACK = [0, 0, 0, 1] as const;
/** The color `drawTextGroup` stages its glyphs in. Read by `pushGlyph` as each
 *  quad is staged and kept by nothing, so one array serves every group. */
const glyphRgba: [number, number, number, number] = [0, 0, 0, 0];

/** Which glyph-paint program `fill` needs, or `null` for a paint the batch
 *  draws as one color. */
function glyphPaintKindOf(fill: Paint): GlyphPaintKind | null {
  const kind = fill.kind ?? 'solid';
  if (kind === 'texture') return 'pattern';
  if (kind === 'linear-gradient' || kind === 'radial-gradient' || kind === 'conic-gradient') {
    return 'gradient';
  }
  return kind === 'solid' ? null : 'texture';
}

/** The atlas's unit while a glyph-paint run draws; the paint has unit 0. */
const GLYPH_PAINT_ATLAS_UNIT = 1;
const OPAQUE_WHITE = [1, 1, 1, 1] as const;

/**
 * Draw one group of atlas glyphs with a texture paint, its coverage masking
 * the paint — see `shaders/glyphPaint.ts`.
 *
 * Its own draw, as a pattern-filled path is: the glyph vertex has no room for
 * a paint coordinate beside its atlas one, and widening it would cost every
 * vertex in every run. The quads still stage through `DrawBatch`, drained
 * first, and are drawn from it here before anything else can stage behind
 * them, so no run ever holds them and nothing outside this function has to
 * know they exist.
 */
function drawPaintedGlyphs(
  ctx: DrawContext, group: LaidOutGroup, dx: number, dy: number,
  kind: GlyphPaintKind, atlasId: string, mode: number, bold: number, tanItalic: number,
  fieldScale: readonly [number, number],
): void {
  const prog = ctx.glyphPaintProgram?.(kind);
  if (!prog) return;
  flushForOwnDraw(ctx);
  const fill = group.fill!.paint!;
  const m = ctx.state.transform;
  let bound: ShaderProgram | null;
  if (kind === 'pattern') {
    bound = bindPattern(ctx, prog, fill as TexturePaint, BATCH_MODEL);
  } else if (kind === 'gradient') {
    bound = bindGradient(ctx, prog, fill as Extract<Paint, { kind: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>, BATCH_MODEL);
  } else {
    const painted = renderPaintToScratch(ctx, fill, glyphScreenBounds(group, dx, dy, tanItalic, m));
    bound = painted && bindScratchPaint(ctx, prog, painted);
  }
  if (!bound) return;
  const gl = ctx.gl;
  ctx.textureCache.bind(atlasId, GLYPH_PAINT_ATLAS_UNIT);
  gl.uniform1i(prog.uniform('u_atlas')!, GLYPH_PAINT_ATLAS_UNIT);
  gl.uniform1f(prog.uniform('u_synthBold')!, bold);
  gl.uniform2f(prog.uniform('u_fieldScale')!, fieldScale[0], fieldScale[1]);
  applyClipTest(ctx);

  const batch = ctx.drawBatch;
  // `flushForOwnDraw` put every clip on the stencil, which this draw tests.
  const cut = batch.clip;
  batch.clip = null;
  const quads = group.quadData;
  for (let at = 0; at < quads.length; at += QUAD_STRIDE) {
    if (batch.wouldOverflow(4)) drawStagedGlyphs(ctx);
    batch.pushGlyph(quads, at, dx, dy, tanItalic, m, OPAQUE_WHITE, GLYPH_PAINT_ATLAS_UNIT, mode, 0);
  }
  drawStagedGlyphs(ctx);
  batch.clip = cut;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindVertexArray(null);
}

function drawStagedGlyphs(ctx: DrawContext): void {
  const batch = ctx.drawBatch;
  if (batch.length === 0) return;
  drawTriangles(ctx, batch.uploadAndBind(), ctx.gl.UNSIGNED_INT);
  batch.reset();
}

/** The screen-space box of a group's glyph quads, corner for corner as
 *  `DrawBatch.pushGlyph` places them. */
function glyphScreenBounds(
  group: LaidOutGroup, dx: number, dy: number, tanItalic: number, m: GlMat3,
): ScreenRect {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const add = (x: number, y: number) => {
    const sx = m[0] * x + m[3] * y + m[6];
    const sy = m[1] * x + m[4] * y + m[7];
    if (sx < b.x0) b.x0 = sx;
    if (sx > b.x1) b.x1 = sx;
    if (sy < b.y0) b.y0 = sy;
    if (sy > b.y1) b.y1 = sy;
  };
  const q = group.quadData;
  for (let at = 0; at < q.length; at += QUAD_STRIDE) {
    const x0 = q[at] + dx, x1 = q[at + 2] + dx, y0 = q[at + 1] + dy, y1 = q[at + 3] + dy;
    const base = q[at + 8] + dy;
    const top = (base - y0) * tanItalic;
    const bottom = (base - y1) * tanItalic;
    add(x0 + top, y0);
    add(x1 + top, y0);
    add(x1 + bottom, y1);
    add(x0 + bottom, y1);
  }
  return b;
}
