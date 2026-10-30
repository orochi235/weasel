import { scaleVertexWidth, type CommandPaint, type Stroke, type Paint, type TexturePaint, type VertexWidth } from '@weasel-js/paint';
import { getPaintDrawKind } from '../paintKinds';
import type { PathDrawCommand } from '../DrawCommand';
import type { GLMeshHandle } from '../cache/GLMeshCache';
import type { Mesh } from '@weasel-js/geom/tessellate';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import { resolveStrokeWidth } from '@weasel-js/stroke';
import { strokeMesh } from '../cache/strokeMeshCache';
import { resolveStrokeLengths, type StrokedPathCommand } from '../strokeLengths';
import { metricKeepsRects, type StrokeSpaces } from '@weasel-js/stroke';
import { cachedMarkerCommands } from '../cache/markerCommandCache';
import { withCornersResolved } from './cornersResolved';
import type { DrawContext } from './drawContext';
import { drawTriangles } from './drawTriangles';
import { fillMesh, meshHandle, fillMeshHandle, flattenToleranceOf } from './mesh';
import {
  atMeshOrigin, drawModel, setColorMatrixUniforms, setProjAndModel, setSolidPaintUniforms,
} from './uniforms';
import { applyClipTest, ancestorMask, beginParityMask, endParityMask } from './stencil';
import { flushForOwnDraw } from './clip';
import { pushRect, pushRampRect, tryStageFill } from './batch';
import { batchPaint } from './gradient';
import { paintBindContext, bindPattern, bindGradient } from './paintBind';
import {
  attachVertexColors, detachVertexColors, tryStageVertexColors, vertexColorBase,
} from './vertexColors';

export function drawPath(ctx: DrawContext, given: PathDrawCommand): void {
  const cmd = withCornersResolved(given);
  // A fill or a stroke with no `paint` paints nothing, the way a node's
  // `fill: null` does. Commands arriving from a consumer painter or overlay
  // can carry one.
  if (cmd.fill?.paint) drawPathFill(ctx, cmd, cmd.fill.paint);
  if (cmd.stroke?.paint) drawPathStroke(ctx, cmd as StrokedPathCommand);
}

function drawPathFill(ctx: DrawContext, cmd: PathDrawCommand, fill: CommandPaint): void {
  // Batchable: see `batchPaint`. A rect skips tessellation entirely; anything
  // else stages its mesh. Both also keep animated demos that mint a fresh Path
  // every frame from allocating a GL buffer per frame.
  const isSolid = fill.kind === undefined || fill.kind === 'solid';
  const hasVColors = !!(cmd.vertexColors && cmd.vertexColors.length > 0);
  const solid = fill as { color: string; opacity?: number };
  const paint = batchPaint(ctx, fill, hasVColors);
  if (paint === null) return;

  if (paint !== undefined && cmd.path.kind === 'rect') {
    if (paint.kind === 'ramp') pushRampRect(ctx, cmd.path, paint);
    else pushRect(ctx, cmd.path, paint);
    return;
  }

  const mesh = fillMesh(ctx, cmd.path);
  const staged = isSolid && hasVColors
    ? tryStageVertexColors(ctx, mesh, cmd.vertexColors!, solid)
    : tryStageFill(ctx, mesh, paint);
  if (staged) return;

  const handle = meshHandle(ctx, mesh);
  atMeshOrigin(ctx, mesh.origin, () => {
    if (isSolid && hasVColors) {
      drawPathFillVColor(ctx, cmd, solid, handle);
    } else if (handle.requiresStencil) {
      drawPathFillStencil(ctx, fill, handle);
    } else {
      drawPathFillByKind(ctx, fill, handle);
    }
  });
}

function drawPathFillVColor(
  ctx: DrawContext,
  cmd: PathDrawCommand,
  fill: { color: string; opacity?: number },
  handle: GLMeshHandle,
): void {
  const gl = ctx.gl;
  const prog = ctx.pathFillVColor;
  gl.useProgram(prog.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, prog);
  setSolidPaintUniforms(ctx, prog, fill.color, fill.opacity);
  setColorMatrixUniforms(ctx, prog);

  const colors = attachVertexColors(gl, prog, cmd.vertexColors!, handle);

  if (handle.requiresStencil) {
    beginParityMask(ctx, handle.indexCount);
    drawTriangles(ctx, handle.indexCount, ctx.gl.UNSIGNED_INT);
    endParityMask(ctx);
  } else {
    applyClipTest(ctx);
    drawTriangles(ctx, handle.indexCount, ctx.gl.UNSIGNED_INT);
  }
  detachVertexColors(gl, colors);
  gl.bindVertexArray(null);
}

/**
 * Bind the program, uniforms and textures for `fill`, and return the program.
 *
 * Split from the draw so a caller owning its own stencil state can paint
 * without `applyClipTest` clobbering it — `drawPathStrokeStenciled` clips a
 * doubled ribbon to one side of the silhouette, and `applyClipTest` at depth 0
 * disables the stencil test outright.
 */
function bindPathFillByKind(ctx: DrawContext, fill: Paint): ShaderProgram | null {
  const kind = fill.kind ?? 'solid';
  if (kind === 'solid') return bindPathFillSolid(ctx, fill as { color: string; opacity?: number });
  if (kind === 'texture') return bindPathFillPattern(ctx, fill as TexturePaint);
  if (kind === 'linear-gradient' || kind === 'radial-gradient' || kind === 'conic-gradient') {
    return bindPathFillGradient(ctx, fill as Extract<Paint, { kind: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>);
  }
  const bind = getPaintDrawKind(kind)?.bind;
  return bind ? bind(paintBindContext(ctx), fill) : null;
}

export function drawPathFillByKind(ctx: DrawContext, fill: Paint, handle: GLMeshHandle): void {
  const prog = bindPathFillByKind(ctx, fill);
  if (!prog) return;
  const gl = ctx.gl;
  gl.bindVertexArray(handle.vao);
  applyClipTest(ctx);
  drawTriangles(ctx, handle.indexCount, ctx.gl.UNSIGNED_INT);
  gl.bindVertexArray(null);
}

function bindPathFillSolid(
  ctx: DrawContext,
  fill: { color: string; opacity?: number },
): ShaderProgram {
  const prog = ctx.pathFill;
  ctx.gl.useProgram(prog.handle);
  setProjAndModel(ctx, prog);
  setSolidPaintUniforms(ctx, prog, fill.color, fill.opacity);
  setColorMatrixUniforms(ctx, prog);
  return prog;
}

function bindPathFillPattern(
  ctx: DrawContext,
  fill: TexturePaint,
): ShaderProgram | null {
  return bindPattern(ctx, ctx.patternFill, fill, drawModel(ctx));
}

function bindPathFillGradient(
  ctx: DrawContext,
  fill: Extract<Paint, { kind: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>,
): ShaderProgram | null {
  return bindGradient(ctx, ctx.gradFill, fill, drawModel(ctx));
}

function drawPathFillStencil(ctx: DrawContext, fill: Paint, handle: GLMeshHandle): void {
  const gl = ctx.gl;
  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.pathFill);

  beginParityMask(ctx, handle.indexCount);
  // The paint binds here, not above: pass 1 runs under a false colorMask, so a
  // uniform missed here renders black while the GL-recorder tests still pass.
  // Not `drawPathFillByKind` — its `applyClipTest` would disable this stencil.
  if (bindPathFillByKind(ctx, fill)) {
    drawTriangles(ctx, handle.indexCount, ctx.gl.UNSIGNED_INT);
  }

  endParityMask(ctx);
  gl.bindVertexArray(null);
}

function drawPathStroke(ctx: DrawContext, rawCmd: StrokedPathCommand): void {
  const { cmd, spaces } = resolveStrokeLengths(ctx.state.transform, rawCmd);
  const stroke = cmd.stroke;
  const align = stroke.align ?? 'center';
  const metric = spaces.ribbon?.metric;
  // A rect the metric turns is no longer a rect in the space its ribbon is
  // built in, so it aligns through the stencil like any polygon.
  const stenciled = cmd.path.kind === 'polygon' || (metric !== undefined && !metricKeepsRects(metric));
  if (stenciled && align !== 'center') {
    flushForOwnDraw(ctx);
    atMeshOrigin(ctx, cmd.path.kind === 'polygon' ? cmd.path.origin : undefined,
      () => drawPathStrokeStenciled(ctx, cmd, align, spaces));
  } else {
    drawPathStrokeUnclipped(ctx, cmd, spaces);
  }
  // After the ribbon, so a head sits on top of the line it caps.
  const width = resolveStrokeWidth(stroke.width ?? 1, 1);
  const heads = cachedMarkerCommands(cmd.path, rawCmd.stroke, stroke, width, flattenToleranceOf(ctx), spaces);
  for (const marker of heads) drawPath(ctx, marker);
}

function drawPathStrokeUnclipped(ctx: DrawContext, cmd: StrokedPathCommand, spaces: StrokeSpaces): void {
  const stroke = cmd.stroke;
  const paint = stroke.paint;
  const mesh = strokeMesh(cmd.path, stroke, flattenToleranceOf(ctx), spaces);
  if (mesh.indices.length === 0) return;

  // Staged, a ribbon allocates nothing and joins the fill it sits on.
  const hasVColors = !!(stroke.vertexColors && stroke.vertexColors.length > 0);
  const batched = batchPaint(ctx, paint, hasVColors);
  if (batched === null) return;
  const staged = hasVColors
    ? tryStageVertexColors(ctx, mesh, stroke.vertexColors!, vertexColorBase(paint))
    : tryStageFill(ctx, mesh, batched);
  if (staged) return;
  atMeshOrigin(ctx, mesh.origin, () => drawOwnRibbon(ctx, stroke, mesh, hasVColors));
}

function drawOwnRibbon(ctx: DrawContext, stroke: StrokedPathCommand['stroke'], mesh: Mesh, hasVColors: boolean): void {
  const paint = stroke.paint;
  const isSolid = paint.kind === undefined || paint.kind === 'solid';
  const solid = paint as { color: string; opacity?: number };
  // The VAO records the per-draw color attribute, so a vertex-colored draw
  // cannot share a persistent one with a draw that has no vertex colors.
  const handle = hasVColors
    ? ctx.meshCache.uploadTransient(mesh)
    : ctx.meshCache.uploadRecurring(mesh);

  if (!isSolid && !hasVColors) {
    drawPathFillByKind(ctx, paint, handle);
    return;
  }

  const gl = ctx.gl;
  if (hasVColors) {
    const prog = ctx.pathFillVColor;
    gl.useProgram(prog.handle);
    gl.bindVertexArray(handle.vao);
    setProjAndModel(ctx, prog);
    const base = vertexColorBase(paint);
    setSolidPaintUniforms(ctx, prog, base.color, base.opacity);
    setColorMatrixUniforms(ctx, prog);

    const colors = attachVertexColors(gl, prog, stroke.vertexColors!, handle);
    applyClipTest(ctx);
    drawTriangles(ctx, handle.indexCount, ctx.gl.UNSIGNED_INT);
    detachVertexColors(gl, colors);
    gl.bindVertexArray(null);
    return;
  }

  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.pathFill);
  setSolidPaintUniforms(ctx, ctx.pathFill, solid.color, solid.opacity);
  setColorMatrixUniforms(ctx, ctx.pathFill);
  applyClipTest(ctx);
  drawTriangles(ctx, handle.indexCount, ctx.gl.UNSIGNED_INT);
  gl.bindVertexArray(null);
}

/** The ribbon cache compares `vertexWidths` by reference, so the doubled copy
 *  has to be the same array on every frame the source array is. */
const DOUBLED_VERTEX_WIDTHS = new WeakMap<VertexWidth[], VertexWidth[]>();

function doubledVertexWidths(widths: VertexWidth[]): VertexWidth[] {
  let doubled = DOUBLED_VERTEX_WIDTHS.get(widths);
  if (doubled === undefined) {
    doubled = widths.map((w) => scaleVertexWidth(w, 2));
    DOUBLED_VERTEX_WIDTHS.set(widths, doubled);
  }
  return doubled;
}

function drawPathStrokeStenciled(
  ctx: DrawContext,
  cmd: StrokedPathCommand,
  align: 'inner' | 'outer',
  spaces: StrokeSpaces,
): void {
  const stroke = cmd.stroke;
  const paint = stroke.paint;
  const widerStroke: Stroke = {
    ...stroke,
    width: resolveStrokeWidth(stroke.width ?? 1, 1) * 2,
    ...(stroke.vertexWidths ? { vertexWidths: doubledVertexWidths(stroke.vertexWidths) } : {}),
    align: 'center',
  };

  const useVColor = !!(stroke.vertexColors && stroke.vertexColors.length > 0);

  const fillHandle = fillMeshHandle(ctx, cmd.path);
  const ribbonMesh = strokeMesh(cmd.path, widerStroke, flattenToleranceOf(ctx), spaces);
  if (ribbonMesh.indices.length === 0) return;
  // The VAO records the per-draw color attribute, so a vertex-colored draw
  // cannot share a persistent one with a draw that has no vertex colors.
  const ribbonHandle = useVColor
    ? ctx.meshCache.uploadTransient(ribbonMesh)
    : ctx.meshCache.uploadRecurring(ribbonMesh);

  const gl = ctx.gl;
  const prog = useVColor ? ctx.pathFillVColor : ctx.pathFill;
  gl.useProgram(prog.handle);
  setProjAndModel(ctx, prog);

  gl.enable(gl.STENCIL_TEST);
  gl.colorMask(false, false, false, false);
  gl.stencilMask(0x01);
  gl.stencilFunc(gl.ALWAYS, 1, 0x01);
  // An even-odd fill is one fan per contour, and only parity cuts its holes.
  gl.stencilOp(gl.KEEP, gl.KEEP, fillHandle.requiresStencil ? gl.INVERT : gl.REPLACE);
  gl.bindVertexArray(fillHandle.vao);
  drawTriangles(ctx, fillHandle.indexCount, ctx.gl.UNSIGNED_INT);

  const clipMask = ancestorMask(ctx.clipDepth);
  gl.colorMask(true, true, true, true);
  if (align === 'inner') {
    gl.stencilFunc(gl.EQUAL, clipMask | 0x01, clipMask | 0x01);
  } else {
    gl.stencilFunc(gl.EQUAL, clipMask, clipMask | 0x01);
  }
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  // Bind the paint here rather than through `drawPathFillByKind`: that calls
  // `applyClipTest`, which at clip depth 0 disables the stencil test this
  // function just set up to clip the ribbon to one side.
  let ribbonProg: ShaderProgram | null = prog;
  if (useVColor) {
    const base = vertexColorBase(paint);
    setSolidPaintUniforms(ctx, prog, base.color, base.opacity);
    setColorMatrixUniforms(ctx, prog);
  } else {
    ribbonProg = bindPathFillByKind(ctx, paint);
  }
  if (!ribbonProg) {
    gl.stencilMask(0x01);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    gl.disable(gl.STENCIL_TEST);
    gl.bindVertexArray(null);
    return;
  }
  gl.bindVertexArray(ribbonHandle.vao);

  const colors = useVColor
    ? attachVertexColors(gl, ribbonProg, stroke.vertexColors!, ribbonHandle)
    : null;

  drawTriangles(ctx, ribbonHandle.indexCount, ctx.gl.UNSIGNED_INT);

  // Narrow to bit 0 first: clear only zeroes bits the mask enables, and
  // pushClip owns bits 1-7.
  gl.stencilMask(0x01);
  gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.disable(gl.STENCIL_TEST);
  if (colors) detachVertexColors(gl, colors);
  gl.bindVertexArray(null);
}
