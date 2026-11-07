import type { DrawCommand, GroupDrawCommand } from '../DrawCommand';
import type { EffectTargets } from '../effects/EffectTargets';
import { compositeProgramId } from '../effects/composite';
import { blendFactorsOf, isOwnComposite, leavesUncovered } from '../effects/compositeOp';
import { effectsReach } from '../effects/types';
import { boxWithin, contentBox, type DeviceRect } from '../retain/contentBounds';
import type { GlMat3 } from '@weasel-js/geom';
import type { DrawContext } from './drawContext';
import { warnOnceUniform } from './customShader';
import { compositeOver, drawFullscreenQuad, insideBuffer, returnToRenderTarget, windowProjection } from './effects';
import { clipTest } from './stencil';
import type { DrawOptions } from './drawTriangles';
import { flushForOwnDraw } from './clip';
import { flushBatch } from './flushBatch';
import { compositeIds } from './idComposite';

type Dispatch = (ctx: DrawContext, cmd: DrawCommand) => void;

const UNBLENDED: DrawOptions = { blend: null };

/** Effects buffer sides are rounded up to this, so a group whose bounds
 *  creep a pixel a frame does not reallocate its buffer every frame. */
const SIDE_STEP = 64;

/**
 * The rect of the drawing buffer, device pixels, a group's effects buffer
 * covers when it joins a target holding `window`: everything the group's
 * passes read on the way to a pixel inside `window`, which is what it paints
 * grown by how far its effects reach, within `window` grown by that much.
 * Content past the drawing buffer within that reach is drawn, so a blur near
 * an edge reads what lies past it. `null` when nothing the group paints
 * reaches `window`.
 *
 * Effects that do not say how far they reach may depend on where in the
 * buffer they run, so they run over the drawing buffer, and a composite that
 * changes what lies outside its group over all of `window`.
 */
export function effectsWindow(
  cmd: GroupDrawCommand, transform: GlMat3, window: DeviceRect,
  width: number, height: number, scale: number, maxSide: number,
): DeviceRect | null {
  const reach = cmd.effects && cmd.effects.length > 0 ? effectsReach(cmd.effects) : 0;
  if (!Number.isFinite(reach)) return { x: 0, y: 0, width, height };
  if (isOwnComposite(cmd.composite) && !leavesUncovered(cmd.composite!)) return window;
  const r = Math.ceil(reach);
  const read = { x: window.x - r, y: window.y - r, width: window.width + 2 * r, height: window.height + 2 * r };
  const box = contentBox([{ ...cmd, clip: undefined }], transform, [], scale);
  const rect = boxWithin(box, read);
  if (rect.width === 0 || rect.height === 0) return null;
  // Grown toward the buffer's far edges, and back inside it where it was, so
  // rounding does not cost it the frame's own projection.
  const w = Math.min(maxSide, Math.ceil(rect.width / SIDE_STEP) * SIDE_STEP);
  const h = Math.min(maxSide, Math.ceil(rect.height / SIDE_STEP) * SIDE_STEP);
  const inside = insideBuffer(rect, width, height);
  return {
    x: inside && w <= width ? Math.min(rect.x, width - w) : rect.x,
    y: inside && h <= height ? Math.min(rect.y, height - h) : rect.y,
    width: w, height: h,
  };
}

/**
 * Draw a group's children into a buffer of their own, run its effects over
 * that buffer, and composite the result back where the group sits.
 *
 * The buffer covers `effectsWindow`, drawn under a projection aimed at its
 * own rect: the frame's own moved to its corner, so its pixels are the ones
 * drawing in place leaves.
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
 *   default framebuffer and means nothing in an offscreen buffer.
 */
export function drawGroupWithEffects(
  ctx: DrawContext, cmd: GroupDrawCommand, targets: EffectTargets, width: number, height: number,
  dispatch: Dispatch,
): void {
  const gpu = ctx.gpu;
  const parentTarget = ctx.renderTarget ?? null;
  const scale = width / ctx.widthCss;
  const rect = effectsWindow(
    cmd, ctx.state.transform, parentTarget?.window ?? { x: 0, y: 0, width, height },
    width, height, scale, ctx.imageCache.maxTextureSide,
  );
  if (!rect) return;
  // Anything staged belongs to the parent's buffer, not this one, and the
  // composite below draws under the parent's clips.
  flushForOwnDraw(ctx);

  const parentClipDepth = ctx.clipDepth;
  const parentClipStack = ctx.clipStack;
  const parentBatchClip = ctx.drawBatch.clip;
  const parentProjection = ctx.projection;

  const ids = ctx.ids;
  // In an id frame the children's ids are drawn here and stay here while the
  // passes, which read and write color alone, run on targets without them.
  const own = targets.acquire(rect.width, rect.height, ids !== undefined);
  let front = own;
  const groupId = cmd.pickId ?? ctx.state.pickId;
  const composited = ctx.state.pushIsolated({
    transform: cmd.transform,
    alpha: cmd.alpha,
    colorMatrix: cmd.colorMatrix,
    pickId: cmd.pickId,
  });
  ctx.clipDepth = 0;
  ctx.clipStack = [];
  ctx.drawBatch.clip = null;
  ctx.projection = windowProjection(rect, scale);
  const pass = { target: own.target, viewport: { x: 0, y: 0, width: rect.width, height: rect.height } };
  ctx.renderTarget = { pass, fragOrigin: [-rect.x, rect.y + rect.height - height], window: rect };

  gpu.endPass();
  gpu.beginPass({ ...pass, clear: { color: true, stencil: true } });

  for (const child of cmd.children) dispatch(ctx, child);
  flushBatch(ctx);

  // Passes replace rather than blend: each writes every texel of its target
  // from the whole of its source, and no pass target has a clip's bits.
  for (const effect of cmd.effects ?? []) {
    const program = ctx.ensureProgram?.(effect.program.id) ?? null;
    if (!program) {
      warnOnceUniform(effect.program.id, '(program)');
      continue;
    }
    const back = targets.acquire(rect.width, rect.height);
    gpu.endPass();
    gpu.beginPass({ target: back.target, viewport: pass.viewport, clear: { color: true } });
    drawFullscreenQuad(ctx, program, front.target.color!, rect.width, rect.height, {
      uniforms: effect.uniforms, programId: effect.program.id, windowOrigin: [rect.x, rect.y], draw: UNBLENDED,
    });
    if (front !== own) targets.release(front);
    front = back;
  }

  // Back to the parent's buffer, and back under its rules.
  ctx.state.pop();
  ctx.clipDepth = parentClipDepth;
  ctx.clipStack = parentClipStack;
  ctx.drawBatch.clip = parentBatchClip;
  ctx.projection = parentProjection;
  ctx.renderTarget = parentTarget;
  returnToRenderTarget(ctx);

  const composite = ctx.ensureProgram?.(compositeProgramId()) ?? null;
  if (composite) {
    const stencil = clipTest(ctx.clipDepth);
    const blend = isOwnComposite(cmd.composite) ? blendFactorsOf(cmd.composite!) : undefined;
    // The color alone: the ids composite next, from the group's own.
    compositeOver(ctx, composite, front.target.color!, rect, composited, { stencil, blend, ids: false });
    if (ids && own.target.ids) {
      compositeIds(ctx, ids, front.target.color!, own.target.ids, rect, composited.alpha, groupId, stencil);
    }
  }
  if (front !== own) targets.release(front);
  targets.release(own);
}
