import type { DrawCommand, GroupDrawCommand } from './DrawCommand';
import { mat3 } from '@weasel-js/geom';
import { getMesh } from './cache/cache';
import { isOwnComposite } from './effects/compositeOp';
import type { DrawContext } from './draw/drawContext';
import { drawShader } from './draw/customShader';
import { enterGroupClip, leaveClip, flushForOwnDraw } from './draw/clip';
import { drawGroupWithEffects } from './draw/groupEffects';
import { drawRetainedGroup } from './draw/retained';
import { drawPath } from './draw/pathPaint';
import { drawText } from './draw/text';
import { drawImage, drawSprites } from './draw/image';

export function dispatch(ctx: DrawContext, cmd: DrawCommand): void {
  switch (cmd.kind) {
    case 'group':  return drawGroup(ctx, cmd);
    case 'path':   return drawPath(ctx, cmd);
    case 'text':   return drawText(ctx, cmd);
    case 'image':  return drawImage(ctx, cmd);
    case 'sprites': return drawSprites(ctx, cmd);
    case 'shader': flushForOwnDraw(ctx); return drawShader(ctx, cmd);
  }
}

/** Whether `cmd` draws into a buffer of its own before joining its parent. */
function ownsSurface(cmd: GroupDrawCommand): boolean {
  return cmd.isolate === true || isOwnComposite(cmd.composite)
    || (cmd.effects !== undefined && cmd.effects.length > 0);
}

export function drawGroup(ctx: DrawContext, cmd: GroupDrawCommand): void {
  if (cmd.retain !== undefined && drawRetainedGroup(ctx, cmd, ownsSurface(cmd), dispatch)) return;
  // A group with effects, or an isolated one, is a render-target boundary
  // rather than another accumulating frame. Without a renderer's buffer pool behind the context
  // there is nowhere to draw, so the effects are skipped and the children
  // paint straight through — a frame missing its blur, not a frame missing.
  if (ownsSurface(cmd) && ctx.effectTargets && ctx.deviceWidth && ctx.deviceHeight) {
    // The clip cuts the composite, so it goes on the parent's buffer, in the
    // group's own space.
    if (cmd.clip) {
      ctx.state.push({ transform: cmd.transform });
      try {
        enterGroupClip(ctx, cmd.clip);
      } finally {
        ctx.state.pop();
      }
    }
    drawGroupWithEffects(ctx, cmd, ctx.effectTargets, ctx.deviceWidth, ctx.deviceHeight, dispatch);
    if (cmd.clip) leaveClip(ctx);
    return;
  }
  ctx.state.push({
    transform: cmd.transform,
    alpha: cmd.alpha,
    colorMatrix: cmd.colorMatrix,
  });
  if (cmd.clip) {
    try {
      enterGroupClip(ctx, cmd.clip);
    } catch (err) {
      ctx.state.pop();
      throw err;
    }
  }
  for (const child of cmd.children) dispatch(ctx, child);
  if (cmd.clip) leaveClip(ctx);
  ctx.state.pop();
}

export { mat3, getMesh };
export type { DrawContext, ClipEntry, GlyphPaintKind } from './draw/drawContext';
export { setUniform } from './draw/customShader';
export { meshBatching, tryStageFill } from './draw/batch';
export { colorFolding } from './draw/foldColor';
export { flushBatch } from './draw/flushBatch';
export { pushClip, popClip } from './draw/clip';
export { OUTLINE_MIN_SCREEN_PX } from './draw/text';
