import type { DrawCommand, GroupDrawCommand, PathDrawCommand } from './DrawCommand';
import type { GroupState } from './GroupState';
import type { GLMeshCache } from './GLMeshCache';
import type { ShaderProgram } from './ShaderProgram';
import { mat3 } from './mat3';
import { getMesh } from './cache';

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

function drawPath(_ctx: DrawContext, _cmd: PathDrawCommand): void {
  // Implemented in next task.
}

// Re-export the projection helper so WeaselRenderer.render can compute it.
export { mat3, getMesh };
