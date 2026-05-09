import type { Stroke } from '@orochi235/weasel';
import type { DrawCommand, GroupDrawCommand, PathDrawCommand } from './DrawCommand';
import type { GroupState } from './GroupState';
import type { GLMeshCache, GLMeshHandle } from './GLMeshCache';
import type { ShaderProgram } from './ShaderProgram';
import { mat3 } from './mat3';
import { getMesh } from './cache';
import { parseColor } from './color';
import { tessellateStroke } from './stroke';

export interface DrawContext {
  gl: WebGL2RenderingContext;
  pathFill: ShaderProgram;
  meshCache: GLMeshCache;
  state: GroupState;
  widthCss: number;
  heightCss: number;
}

export function dispatch(ctx: DrawContext, cmd: DrawCommand): void {
  switch (cmd.kind) {
    case 'group': return drawGroup(ctx, cmd);
    case 'path': return drawPath(ctx, cmd);
  }
}

function drawGroup(ctx: DrawContext, cmd: GroupDrawCommand): void {
  ctx.state.push({ transform: cmd.transform, alpha: cmd.alpha });
  for (const child of cmd.children) dispatch(ctx, child);
  ctx.state.pop();
}

function drawPath(ctx: DrawContext, cmd: PathDrawCommand): void {
  if (!cmd.fill && !cmd.stroke) return;

  if (cmd.fill) {
    const mesh = getMesh(cmd.path);
    const handle = ctx.meshCache.handleFor(mesh);
    if (handle.requiresStencil) {
      drawPathFillStencil(ctx, cmd.fill, handle);
    } else {
      drawPathFillSolid(ctx, cmd.fill, handle);
    }
  }

  if (cmd.stroke) {
    drawPathStroke(ctx, cmd);
  }
}

function setProjAndModel(ctx: DrawContext): void {
  const gl = ctx.gl;
  const proj = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
  gl.uniformMatrix3fv(ctx.pathFill.uniform('u_proj')!, false, proj);
  gl.uniformMatrix3fv(ctx.pathFill.uniform('u_model')!, false, ctx.state.transform);
}

function setSolidPaintUniforms(
  ctx: DrawContext,
  color: string,
  opacity: number | undefined,
): void {
  const gl = ctx.gl;
  const [r, g, b, a] = parseColor(color);
  gl.uniform4f(ctx.pathFill.uniform('u_color')!, r, g, b, a * (opacity ?? 1));
  gl.uniform1f(ctx.pathFill.uniform('u_alpha')!, ctx.state.alpha);
}

function drawPathFillSolid(ctx: DrawContext, fill: NonNullable<PathDrawCommand['fill']>, handle: GLMeshHandle): void {
  const gl = ctx.gl;
  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx);
  setSolidPaintUniforms(ctx, fill.color, fill.opacity);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

function drawPathFillStencil(ctx: DrawContext, fill: NonNullable<PathDrawCommand['fill']>, handle: GLMeshHandle): void {
  const gl = ctx.gl;
  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx);

  // Pass 1: build stencil. Disable color writes; INVERT stencil per fragment.
  gl.enable(gl.STENCIL_TEST);
  gl.colorMask(false, false, false, false);
  gl.stencilMask(0xff);
  gl.stencilFunc(gl.ALWAYS, 0, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);

  // Pass 2: paint where stencil != 0.
  gl.colorMask(true, true, true, true);
  gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  setSolidPaintUniforms(ctx, fill.color, fill.opacity);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);

  gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.disable(gl.STENCIL_TEST);
  gl.bindVertexArray(null);
}

function drawPathStroke(ctx: DrawContext, cmd: PathDrawCommand): void {
  const stroke = cmd.stroke!;
  const paint = stroke.paint;
  // Step 2: solid only. Gradient/pattern stroke paints arrive in step 4.
  if (paint.fill && paint.fill !== 'solid') {
    throw new Error('weasel-gl step 2: stroke.paint must be solid; gradient/pattern arrives in step 4');
  }
  const solid = paint as { color: string; opacity?: number };

  const mesh = tessellateStroke(cmd.path, stroke);
  if (mesh.indices.length === 0) return;
  const handle = ctx.meshCache.handleFor(mesh);

  const gl = ctx.gl;
  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx);
  setSolidPaintUniforms(ctx, solid.color, solid.opacity);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

// Re-export the projection helper so WeaselRenderer.render can compute it.
export { mat3, getMesh };

// Avoid an unused-type warning on the standalone Stroke import (used in
// future stencil-clipped stroke task).
export type _StrokeMarker = Stroke;
