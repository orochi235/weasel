import type { DrawCommand, GroupDrawCommand, PathDrawCommand } from './DrawCommand';
import type { GroupState } from './GroupState';
import type { GLMeshCache, GLMeshHandle } from './GLMeshCache';
import type { ShaderProgram } from './ShaderProgram';
import { mat3 } from './mat3';
import { getMesh } from './cache';
import { parseColor } from './color';

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
  if (!cmd.fill) return;

  const mesh = getMesh(cmd.path);
  const handle = ctx.meshCache.handleFor(mesh);
  const gl = ctx.gl;

  if (handle.requiresStencil) {
    drawPathStencil(ctx, cmd, handle);
    return;
  }

  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);

  const proj = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
  gl.uniformMatrix3fv(ctx.pathFill.uniform('u_proj')!, false, proj);
  gl.uniformMatrix3fv(ctx.pathFill.uniform('u_model')!, false, ctx.state.transform);

  const [r, g, b, a] = parseColor(cmd.fill.color);
  const opacity = cmd.fill.opacity ?? 1;
  gl.uniform4f(ctx.pathFill.uniform('u_color')!, r, g, b, a * opacity);
  gl.uniform1f(ctx.pathFill.uniform('u_alpha')!, ctx.state.alpha);

  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

function drawPathStencil(_ctx: DrawContext, _cmd: PathDrawCommand, _handle: GLMeshHandle): void {
  // Implemented in next task.
}

// Re-export the projection helper so WeaselRenderer.render can compute it.
export { mat3, getMesh };
