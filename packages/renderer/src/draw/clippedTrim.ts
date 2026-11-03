/**
 * A trimmed stroke drawn from one cached ribbon whatever its trim, the trim
 * clipping it in the shader (`@weasel-js/stroke`'s `clipRibbon`), so a trim
 * that animates rebuilds nothing.
 *
 * The clipped ribbon keeps each segment's whole quad at a turn, and its cut
 * ends are drawn over it as geometry (`clipWindow`), so in places it covers
 * twice what the rebuilt ribbon covers once: the same pixels for an opaque
 * stroke, darker ones for a translucent one. A translucent
 * stroke, and one the batch would take anyway, which is small enough to
 * rebuild, are rebuilt trimmed instead. So are a stroke built in a stretched
 * view's metric, a vertex-colored one, and any paint but a solid.
 */
import type { Mesh } from '@weasel-js/geom/tessellate';
import { resolveColor, type StrokeTrim } from '@weasel-js/paint';
import { clipWindow, type StrokeSpaces } from '@weasel-js/stroke';
import { strokeClipRibbon } from '../cache/strokeMeshCache';
import type { StrokedPathCommand } from '../strokeLengths';
import { canBatchMesh } from './batch';
import { flushForOwnDraw } from './clip';
import type { DrawContext } from './drawContext';
import { drawTriangles } from './drawTriangles';
import { flattenToleranceOf } from './mesh';
import { applyClipTest } from './stencil';
import { atMeshOrigin, setColorMatrixUniforms, setProjAndModel, setSolidPaintUniforms } from './uniforms';

/**
 * Draw `cmd`'s trimmed stroke clipped from its cached ribbon, handing the
 * geometry its cut ends are drawn with to `drawEnds`. Returns `false`, having
 * drawn nothing, where the stroke is to be rebuilt trimmed instead.
 */
export function drawClippedTrim(
  ctx: DrawContext, cmd: StrokedPathCommand, spaces: StrokeSpaces, drawEnds: (ends: Mesh) => void,
): boolean {
  const { stroke } = cmd;
  const trim: StrokeTrim | undefined = stroke.trim;
  const variants = ctx.batchVariants;
  if (trim === undefined || variants?.trimClip !== true) return false;
  if (spaces.ribbon?.metric || spaces.start?.metric || spaces.end?.metric) return false;
  if (stroke.vertexColors && stroke.vertexColors.length > 0) return false;
  const paint = stroke.paint;
  if ((paint.kind !== undefined && paint.kind !== 'solid') || !opaque(ctx, paint)) return false;

  const ribbon = strokeClipRibbon(cmd.path, stroke, flattenToleranceOf(ctx));
  if (ribbon.mesh.indices.length === 0) return true;
  if (canBatchMesh(ctx, ribbon.mesh)) return false;
  const window = clipWindow(ribbon, cmd.path, trim, oneScreenPixel(ctx));
  if (window === null) return true;

  flushForOwnDraw(ctx);
  const gl = ctx.gl;
  const prog = variants.trimmedRibbon();
  const location = prog.attribute('a_trim');
  if (location === undefined) return true;
  const handle = ctx.meshCache.uploadRecurring(ribbon.mesh, { location, size: 4, data: ribbon.trim });
  atMeshOrigin(ctx, ribbon.mesh.origin, () => {
    gl.useProgram(prog.handle);
    gl.bindVertexArray(handle.vao);
    setProjAndModel(ctx, prog);
    setSolidPaintUniforms(ctx, prog, paint.color, paint.opacity);
    setColorMatrixUniforms(ctx, prog);
    const at = prog.uniform('u_trim');
    if (at !== undefined) gl.uniform2f(at, window.from, window.to);
    applyClipTest(ctx);
    drawTriangles(ctx, handle.indexCount, gl.UNSIGNED_INT);
    gl.bindVertexArray(null);
  });
  if (window.ends) drawEnds(window.ends);
  return true;
}

/** Whether `paint` reaches the target with alpha 1 under the group drawing now. */
function opaque(ctx: DrawContext, paint: { color: string; opacity?: number }): boolean {
  if (resolveColor(paint.color)[3] * (paint.opacity ?? 1) < 1 || ctx.state.alpha < 1) return false;
  // Row-major 4x5: the alpha row must pass alpha through untouched.
  const m = ctx.state.colorMatrix;
  return m[15] === 0 && m[16] === 0 && m[17] === 0 && m[18] === 1 && m[19] === 0;
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
