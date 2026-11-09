import { scaleVertexWidth, type CommandPaint, type Stroke, type Paint, type VertexWidth } from '@weasel-js/paint';
import type { PathDrawCommand } from '../DrawCommand';
import type { GLMeshHandle } from '../cache/GLMeshCache';
import type { Mesh } from '@weasel-js/geom/tessellate';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import { inkWidth, resolveStrokeWidth } from '@weasel-js/stroke';
import { strokeMesh } from '../cache/strokeMeshCache';
import { resolveStrokeLengths, type StrokedPathCommand } from '../strokeLengths';
import { ribbonAligns, type StrokeSpaces } from '@weasel-js/stroke';
import { cachedMarkerHeads } from '../cache/markerCommandCache';
import { withCornersResolved } from './cornersResolved';
import type { DrawContext } from './drawContext';
import { drawTriangles } from './drawTriangles';
import { fillMesh, meshHandle, fillMeshHandle, flattenToleranceOf } from './mesh';
import { alignedRibbon } from './alignedRibbon';
import { drawClippedTrim } from './clippedTrim';
import {
  atMeshOrigin, setColorMatrixUniforms, setProjAndModel, setSolidPaintUniforms,
} from './uniforms';
import {
  ALIGNED_FILL, ALIGNED_FILL_PARITY, alignedRibbon as alignedRibbonStencil, clipTest, drawParityMask, endParityMask,
} from './stencil';
import { flushForOwnDraw } from './clip';
import { pushRect, pushRampRect, tryStageFill } from './batch';
import { batchPaint } from './gradient';
import { pushPatternRect } from './patternBatch';
import { bindPathFillByKind } from './paintBind';
import {
  releaseVertexColors, tryStageVertexColors, vertexColorBase, withVertexColors,
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
    else if (paint.kind === 'pattern') pushPatternRect(ctx, cmd.path, paint);
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
  const prog = ctx.pathFillVColor;
  setProjAndModel(ctx, prog);
  setSolidPaintUniforms(ctx, prog, fill.color, fill.opacity);
  setColorMatrixUniforms(ctx, prog);

  const colored = withVertexColors(ctx, prog, cmd.vertexColors!, handle);
  if (handle.requiresStencil) {
    const stencil = drawParityMask(ctx, prog, colored.geometry, handle.indexCount);
    drawTriangles(ctx, prog, colored.geometry, handle.indexCount, { stencil });
    endParityMask(ctx);
  } else {
    drawTriangles(ctx, prog, colored.geometry, handle.indexCount, { stencil: clipTest(ctx.clipDepth) });
  }
  releaseVertexColors(ctx, colored);
}

export function drawPathFillByKind(ctx: DrawContext, fill: Paint, handle: GLMeshHandle): void {
  const prog = bindPathFillByKind(ctx, fill);
  if (!prog) return;
  drawTriangles(ctx, prog, handle.geometry, handle.indexCount, { stencil: clipTest(ctx.clipDepth) });
}

function drawPathFillStencil(ctx: DrawContext, fill: Paint, handle: GLMeshHandle): void {
  setProjAndModel(ctx, ctx.pathFill);
  const stencil = drawParityMask(ctx, ctx.pathFill, handle.geometry, handle.indexCount);
  // The paint binds here, not above: pass 1 writes no color, so a uniform
  // missed here renders black while the GL-recorder tests still pass. Not
  // `drawPathFillByKind` — it draws under the clip test, not this stencil.
  const prog = bindPathFillByKind(ctx, fill);
  if (prog) drawTriangles(ctx, prog, handle.geometry, handle.indexCount, { stencil });
  endParityMask(ctx);
}

function drawPathStroke(ctx: DrawContext, rawCmd: StrokedPathCommand): void {
  const { cmd, spaces } = resolveStrokeLengths(ctx.state.transform, rawCmd);
  const stroke = cmd.stroke;
  // No width draws nothing, heads and per-vertex widths included.
  const width = resolveStrokeWidth(stroke.width ?? 1, 1);
  if (!inkWidth(width)) return;
  const align = stroke.align ?? 'center';
  const metric = spaces.ribbon?.metric;
  // A rect the metric turns is no longer a rect in the space its ribbon is
  // built in, and one an inner stroke overfills has no shifted rect, so each
  // is cut to its side like any polygon.
  const sided = align !== 'center' && !ribbonAligns(cmd.path, stroke, metric) ? align : null;
  const cut = sided ? cutAlignedRibbon(ctx, cmd, sided, spaces) : null;
  if (cut !== null) {
    drawRibbon(ctx, cmd, cut);
  } else if (sided) {
    flushForOwnDraw(ctx);
    atMeshOrigin(ctx, cmd.path.kind === 'polygon' ? cmd.path.origin : undefined,
      () => drawPathStrokeStenciled(ctx, cmd, sided, spaces));
  } else {
    drawPathStrokeUnclipped(ctx, cmd, spaces);
  }
  // After the ribbon, so a head sits on top of the line it caps.
  const heads = cachedMarkerHeads(cmd.path, rawCmd.stroke, stroke, width, flattenToleranceOf(ctx), spaces);
  for (const { draws, transform } of heads) {
    for (const { cmd: head, inLineFrame } of draws) {
      ctx.state.push({ transform, keepPaintFrame: inLineFrame });
      try {
        drawPath(ctx, head);
      } finally {
        ctx.state.pop();
      }
    }
  }
}

function drawPathStrokeUnclipped(ctx: DrawContext, cmd: StrokedPathCommand, spaces: StrokeSpaces): void {
  if (drawClippedTrim(ctx, cmd, spaces, (ends) => drawRibbon(ctx, cmd, ends))) return;
  drawRibbon(ctx, cmd, strokeMesh(cmd.path, cmd.stroke, flattenToleranceOf(ctx), spaces));
}

/** An aligned stroke's ribbon cut to its side of the fill on the CPU, or
 *  `null` where only the stencil can cut it (`alignedRibbon`), or with
 *  per-vertex colors, which the cut has no anchors to carry. */
function cutAlignedRibbon(
  ctx: DrawContext, cmd: StrokedPathCommand, align: 'inner' | 'outer', spaces: StrokeSpaces,
): Mesh | null {
  if (cmd.stroke.vertexColors && cmd.stroke.vertexColors.length > 0) return null;
  if (ctx.batchVariants?.cuts === false) return null;
  const ribbon = strokeMesh(cmd.path, doubledStroke(cmd.stroke), flattenToleranceOf(ctx), spaces);
  return alignedRibbon(ribbon, fillMesh(ctx, cmd.path), align === 'inner');
}

function drawRibbon(ctx: DrawContext, cmd: StrokedPathCommand, mesh: Mesh): void {
  const stroke = cmd.stroke;
  const paint = stroke.paint;
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

  const stencil = clipTest(ctx.clipDepth);
  if (hasVColors) {
    const prog = ctx.pathFillVColor;
    setProjAndModel(ctx, prog);
    const base = vertexColorBase(paint);
    setSolidPaintUniforms(ctx, prog, base.color, base.opacity);
    setColorMatrixUniforms(ctx, prog);

    const colored = withVertexColors(ctx, prog, stroke.vertexColors!, handle);
    drawTriangles(ctx, prog, colored.geometry, handle.indexCount, { stencil });
    releaseVertexColors(ctx, colored);
    return;
  }

  setProjAndModel(ctx, ctx.pathFill);
  setSolidPaintUniforms(ctx, ctx.pathFill, solid.color, solid.opacity);
  setColorMatrixUniforms(ctx, ctx.pathFill);
  drawTriangles(ctx, ctx.pathFill, handle.geometry, handle.indexCount, { stencil });
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

/** The centered stroke twice as wide that an aligned one is cut from. */
function doubledStroke(stroke: Stroke): Stroke {
  return {
    ...stroke,
    width: resolveStrokeWidth(stroke.width ?? 1, 1) * 2,
    ...(stroke.vertexWidths ? { vertexWidths: doubledVertexWidths(stroke.vertexWidths) } : {}),
    align: 'center',
  };
}

function drawPathStrokeStenciled(
  ctx: DrawContext,
  cmd: StrokedPathCommand,
  align: 'inner' | 'outer',
  spaces: StrokeSpaces,
): void {
  const stroke = cmd.stroke;
  const paint = stroke.paint;
  const widerStroke = doubledStroke(stroke);

  const useVColor = !!(stroke.vertexColors && stroke.vertexColors.length > 0);

  const fillHandle = fillMeshHandle(ctx, cmd.path);
  const ribbonMesh = strokeMesh(cmd.path, widerStroke, flattenToleranceOf(ctx), spaces);
  if (ribbonMesh.indices.length === 0) return;
  // The VAO records the per-draw color attribute, so a vertex-colored draw
  // cannot share a persistent one with a draw that has no vertex colors.
  const ribbonHandle = useVColor
    ? ctx.meshCache.uploadTransient(ribbonMesh)
    : ctx.meshCache.uploadRecurring(ribbonMesh);

  const prog = useVColor ? ctx.pathFillVColor : ctx.pathFill;
  setProjAndModel(ctx, prog);
  // An even-odd fill is one fan per contour, and only parity cuts its holes.
  drawTriangles(ctx, prog, fillHandle.geometry, fillHandle.indexCount, {
    stencil: fillHandle.requiresStencil ? ALIGNED_FILL_PARITY : ALIGNED_FILL, colorWrite: false,
  });

  const stencil = alignedRibbonStencil(ctx.clipDepth, align === 'inner');
  // Bind the paint here rather than through `drawPathFillByKind`, which draws
  // under the clip test and not this ribbon's side of the silhouette.
  let ribbonProg: ShaderProgram | null = prog;
  if (useVColor) {
    const base = vertexColorBase(paint);
    setSolidPaintUniforms(ctx, prog, base.color, base.opacity);
    setColorMatrixUniforms(ctx, prog);
  } else {
    ribbonProg = bindPathFillByKind(ctx, paint);
  }
  if (ribbonProg) {
    const colored = useVColor ? withVertexColors(ctx, ribbonProg, stroke.vertexColors!, ribbonHandle) : null;
    drawTriangles(ctx, ribbonProg, colored ? colored.geometry : ribbonHandle.geometry, ribbonHandle.indexCount, { stencil });
    if (colored) releaseVertexColors(ctx, colored);
  }
  // Bit 0 only: the clips own bits 1-7.
  endParityMask(ctx);
}
