/**
 * A stroke too large to batch, drawn from one cached ribbon whatever its trim,
 * the trim clipping it in the shader (`@weasel-js/stroke`'s `clipRibbon`), so a
 * trim that animates rebuilds nothing. An untrimmed stroke draws the same
 * ribbon through a window that covers it whole, so a tween that ends at the
 * full stroke looks as the stroke does with no trim at all.
 *
 * The ribbon keeps each segment's whole quad at a turn, and its cut ends are
 * drawn over it as geometry (`clipWindow`), so in places it covers ground
 * twice. An opaque solid stroke cannot show that and draws straight. Any
 * other — translucent, vertex-colored, or in a paint but a solid — marks what
 * it covers in the stencil and then paints its untrimmed ribbon there once;
 * where a turn's quads overlap, the earlier segment paints, so vertex colors
 * there are that segment's rather than split at the bisector. A stroke built
 * in a stretched view's metric is clipped in that metric's measure. A stroke
 * the batch takes, which is small and joins the run it sits in, is built by
 * the tessellator instead, trimmed or not, as is one whose heads are built in
 * a space its ribbon is not.
 */
import type { Mesh } from '@weasel-js/geom/tessellate';
import { parseColor, type CommandPaint, type StrokeTrim } from '@weasel-js/paint';
import { clipWindow, type ClipRibbon, type ClipWindow, type StrokeSpaces } from '@weasel-js/stroke';
import type { GLMeshHandle } from '../cache/GLMeshCache';
import { strokeClipRibbon } from '../cache/strokeMeshCache';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import type { StrokedPathCommand } from '../strokeLengths';
import { canBatchMesh } from './batch';
import { flushForOwnDraw } from './clip';
import type { DrawContext } from './drawContext';
import { drawTriangles } from './drawTriangles';
import { flattenToleranceOf } from './mesh';
import { bindPathFillByKind } from './paintBind';
import { clipTest, endParityMask, parityPaint, trimMark } from './stencil';
import { atMeshOrigin, setColorMatrixUniforms, setProjAndModel, setSolidPaintUniforms } from './uniforms';
import { releaseVertexColors, vertexColorBase, withVertexColors } from './vertexColors';

/**
 * Draw `cmd`'s stroke clipped from its cached ribbon to its trim, or whole
 * with none, handing the geometry its cut ends are drawn with to `drawEnds`
 * where it draws straight. Returns `false`, having drawn nothing, where the
 * tessellator is to build the stroke instead.
 */
export function drawClippedTrim(
  ctx: DrawContext, cmd: StrokedPathCommand, spaces: StrokeSpaces, drawEnds: (ends: Mesh) => void,
): boolean {
  const { stroke } = cmd;
  const trim: StrokeTrim = stroke.trim ?? WHOLE;
  const variants = ctx.batchVariants;
  if (variants?.trimClip !== true) return false;
  const metric = spaces.ribbon?.metric;
  if (spaces.start?.metric !== metric || spaces.end?.metric !== metric) return false;

  const ribbon = strokeClipRibbon(cmd.path, stroke, flattenToleranceOf(ctx), spaces);
  if (ribbon.mesh.indices.length === 0) return true;
  if (canBatchMesh(ctx, ribbon.mesh)) return false;
  const window = clipWindow(ribbon, cmd.path, trim, metric ? onePixelInMetric(ctx) : oneScreenPixel(ctx));
  if (window === null) return true;

  flushForOwnDraw(ctx);
  const prog = variants.trimmedRibbon();
  const location = prog.attribute('a_trim');
  if (location === undefined) return true;
  const handle = ctx.meshCache.uploadRecurring(ribbon.mesh, { location, size: 4, data: ribbon.trim });
  const colors = stroke.vertexColors && stroke.vertexColors.length > 0 ? stroke.vertexColors : undefined;
  const paint = stroke.paint;
  if (colors === undefined && (paint.kind === undefined || paint.kind === 'solid') && opaque(ctx, paint)) {
    atMeshOrigin(ctx, ribbon.mesh.origin, () => {
      clipBy(ctx, prog, window);
      setSolidPaintUniforms(ctx, prog, paint.color, paint.opacity);
      setColorMatrixUniforms(ctx, prog);
      drawTriangles(ctx, prog, handle.geometry, handle.indexCount, { stencil: clipTest(ctx.clipDepth) });
    });
    if (window.ends) drawEnds(window.ends);
    return true;
  }
  atMeshOrigin(ctx, ribbon.mesh.origin, () => markAndCover(ctx, prog, ribbon, handle, window, paint, colors));
  return true;
}

function clipBy(ctx: DrawContext, prog: ShaderProgram, window: ClipWindow): void {
  setProjAndModel(ctx, prog);
  prog.set2f('u_trim', window.from, window.to);
}

/**
 * Mark on stencil bit 0 what the clipped ribbon and its ends cover, then
 * paint the untrimmed ribbon and the ends where it is marked, clearing it as
 * they go, so a pixel covered twice paints once.
 */
function markAndCover(
  ctx: DrawContext, prog: ShaderProgram, ribbon: ClipRibbon, handle: GLMeshHandle, window: ClipWindow,
  paint: CommandPaint, colors: number[] | undefined,
): void {
  const mark = trimMark(ctx.clipDepth);
  clipBy(ctx, prog, window);
  drawTriangles(ctx, prog, handle.geometry, handle.indexCount, { stencil: mark, colorWrite: false });
  const ends = window.ends ? ctx.meshCache.uploadTransient(window.ends) : null;
  if (ends) {
    setProjAndModel(ctx, ctx.pathFill);
    drawTriangles(ctx, ctx.pathFill, ends.geometry, ends.indexCount, { stencil: mark, colorWrite: false });
  }
  const cover = parityPaint(ctx.clipDepth);
  if (colors !== undefined) {
    const vc = ctx.pathFillVColor;
    setProjAndModel(ctx, vc);
    const base = vertexColorBase(paint);
    setSolidPaintUniforms(ctx, vc, base.color, base.opacity);
    setColorMatrixUniforms(ctx, vc);
    for (const h of ends ? [handle, ends] : [handle]) {
      const colored = withVertexColors(ctx, vc, colors, h);
      drawTriangles(ctx, vc, colored.geometry, h.indexCount, { stencil: cover });
      releaseVertexColors(ctx, colored);
    }
    return;
  }
  const painted = bindPathFillByKind(ctx, paint);
  if (painted === null) {
    endParityMask(ctx);
    return;
  }
  // A registered paint kind's program may read attributes the trim's slot would answer.
  const own = paint.kind === undefined || paint.kind === 'solid' || paint.kind === 'texture' || paint.kind.endsWith('-gradient');
  const body = own ? handle : ctx.meshCache.uploadRecurring(coverMesh(ribbon));
  drawTriangles(ctx, painted, body.geometry, body.indexCount, { stencil: cover });
  if (ends) drawTriangles(ctx, painted, ends.geometry, ends.indexCount, { stencil: cover });
}

const WHOLE: StrokeTrim = {};

const COVERS = new WeakMap<ClipRibbon, Mesh>();

/** The ribbon's mesh as an object of its own, uploaded without the trim's attribute. */
function coverMesh(ribbon: ClipRibbon): Mesh {
  let mesh = COVERS.get(ribbon);
  if (mesh === undefined) COVERS.set(ribbon, (mesh = { ...ribbon.mesh }));
  return mesh;
}

/** Whether `paint` reaches the target with alpha 1 under the group drawing now. */
function opaque(ctx: DrawContext, paint: { color: string; opacity?: number }): boolean {
  if (parseColor(paint.color)[3] * (paint.opacity ?? 1) < 1 || ctx.state.alpha < 1) return false;
  // Row-major 4x5: the alpha row must pass alpha through untouched.
  const m = ctx.state.colorMatrix;
  return m[15] === 0 && m[16] === 0 && m[17] === 0 && m[18] === 1 && m[19] === 0;
}

/** One screen pixel in a stroke metric's units, which the screen measures alike in every direction. */
function onePixelInMetric(ctx: DrawContext): number {
  const m = ctx.state.transform;
  const det = Math.abs(m[0] * m[4] - m[1] * m[3]);
  return det > 0 ? 1 / Math.sqrt(det) : 0;
}

/** The shortest world length that spans a pixel on screen whichever way it runs. */
function oneScreenPixel(ctx: DrawContext): number {
  const m = ctx.state.transform;
  const a = m[0], b = m[1], c = m[3], d = m[4];
  const sum = a * a + b * b + c * c + d * d;
  const det = Math.abs(a * d - b * c);
  const largest = Math.sqrt((sum + Math.sqrt(Math.max(0, sum * sum - 4 * det * det))) / 2);
  return det > 0 ? largest / det : 0;
}
