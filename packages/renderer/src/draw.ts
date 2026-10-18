import type { DrawCommand, GroupDrawCommand } from './DrawCommand';
import { mat3 } from '@weasel-js/geom';
import { getMesh } from './cache/cache';
import type { EffectTargets } from './effects/EffectTargets';
import { compositeProgramId } from './effects/composite';
import { applyComposite, isOwnComposite } from './effects/compositeOp';
import type { DrawContext } from './draw/drawContext';
import { warnOnceUniform, drawShader } from './draw/customShader';
import { returnToRenderTarget, drawFullscreenQuad } from './draw/effects';
import { applyClipTest } from './draw/stencil';
import { enterGroupClip, leaveClip, flushForOwnDraw } from './draw/clip';
import { flushBatch } from './draw/flushBatch';
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

/**
 * Draw a group's children into a buffer of their own, run its effects over
 * that buffer, and composite the result back where the group sits.
 *
 * Three things are deliberately not inherited by the offscreen render:
 *
 * - **The clip.** A fresh buffer's stencil is empty, so a child drawn at the
 *   enclosing clip depth would test against bits that were never written and
 *   paint nothing. The enclosing clip belongs on the composite anyway — it
 *   clips the group's result, not the pixels an effect reads — so `clipDepth`
 *   restarts at 0 inside, which also hands nested clips a fresh budget.
 * - **Alpha and color**, for the same reason from the other end: fading on
 *   the way in would give the effect faded pixels to read, and fade them
 *   again on the way out. `pushIsolated` returns what the composite owes.
 * - **The scissor**, which belongs to the renderer's sub-rect within the
 *   default framebuffer and means nothing in a buffer sized to the whole
 *   drawing buffer.
 */
function drawGroupWithEffects(
  ctx: DrawContext,
  cmd: GroupDrawCommand,
  targets: EffectTargets,
  width: number,
  height: number,
): void {
  const gl = ctx.gl;
  // Anything staged belongs to the parent's buffer, not this one, and the
  // composite below draws under the parent's clips.
  flushForOwnDraw(ctx);

  const parentTarget = ctx.renderTarget ?? null;
  const parentClipDepth = ctx.clipDepth;
  const parentClipStack = ctx.clipStack;
  const parentBatchClip = ctx.drawBatch.clip;
  const scissorWasOn = gl.isEnabled(gl.SCISSOR_TEST);

  let front = targets.acquire(width, height);
  const composited = ctx.state.pushIsolated({
    transform: cmd.transform,
    alpha: cmd.alpha,
    colorMatrix: cmd.colorMatrix,
  });
  ctx.clipDepth = 0;
  ctx.clipStack = [];
  ctx.drawBatch.clip = null;

  gl.bindFramebuffer(gl.FRAMEBUFFER, front.fbo);
  ctx.renderTarget = front;
  gl.viewport(0, 0, width, height);
  gl.disable(gl.SCISSOR_TEST);
  gl.stencilMask(0xFF);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

  for (const child of cmd.children) dispatch(ctx, child);
  flushBatch(ctx);

  // Passes replace rather than blend: each writes every texel of its target
  // from the whole of its source. A child that ended by popping a stencil
  // clip leaves the test on, and no pass target has that clip's bits.
  gl.disable(gl.BLEND);
  gl.disable(gl.STENCIL_TEST);
  for (const effect of cmd.effects ?? []) {
    const program = ctx.ensureProgram?.(effect.program.id) ?? null;
    if (!program) {
      warnOnceUniform(effect.program.id, '(program)');
      continue;
    }
    const back = targets.acquire(width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, back.fbo);
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    drawFullscreenQuad(ctx, program, front.texture, width, height, effect.uniforms,
      undefined, effect.program.id);
    targets.release(front);
    front = back;
  }
  gl.enable(gl.BLEND);

  // Back to the parent's buffer, and back under its rules.
  ctx.state.pop();
  ctx.clipDepth = parentClipDepth;
  ctx.clipStack = parentClipStack;
  ctx.drawBatch.clip = parentBatchClip;
  ctx.renderTarget = parentTarget;
  returnToRenderTarget(ctx, width, height, scissorWasOn);

  const composite = ctx.ensureProgram?.(compositeProgramId()) ?? null;
  if (composite) {
    applyClipTest(ctx);
    const ownBlend = isOwnComposite(cmd.composite);
    if (ownBlend) applyComposite(gl, cmd.composite!);
    drawFullscreenQuad(ctx, composite, front.texture, width, height, undefined, {
      alpha: composited.alpha,
      colorMatrix: composited.colorMatrix,
    });
    if (ownBlend) applyComposite(gl, 'source-over');
  }
  targets.release(front);
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
    drawGroupWithEffects(ctx, cmd, ctx.effectTargets, ctx.deviceWidth, ctx.deviceHeight);
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
