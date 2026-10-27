import type { DrawCommand, GroupDrawCommand } from '../DrawCommand';
import { compositeProgramId } from '../effects/composite';
import { isOwnComposite, readsBackdrop } from '../effects/compositeOp';
import { IDENTITY_COLOR_MATRIX } from '../state/GroupState';
import type { RetainedClip, RetainedKey } from '../retain/retainedKey';
import { contentBounds, type DeviceRect } from '../retain/contentBounds';
import type { DrawContext } from './drawContext';
import { drawFullscreenQuad, returnToRenderTarget } from './effects';
import { applyClipTest } from './stencil';
import { enterGroupClip } from './clip';
import { flushBatch } from './flushBatch';

type Dispatch = (ctx: DrawContext, cmd: DrawCommand) => void;

const COMPOSITE_AS_DRAWN = { alpha: 1, colorMatrix: IDENTITY_COLOR_MATRIX };

/** The scratch buffer as a render target: retained draws share it, so one
 *  cannot be drawn inside another. */
const scratchTargets = new WeakSet<object>();

/**
 * Draw a group carrying `retain` from the pixels it left last time, drawing
 * them again first if anything they were drawn under has moved. `false` when
 * no surface can stand in for it here, and the caller draws it as an ordinary
 * group.
 *
 * Inside, the group draws under everything it would on the canvas — the
 * transform, alpha and color matrix of the stack above it, and every clip
 * enclosing it — into a cleared multisampled buffer, so source-over makes
 * compositing the result the same as drawing it in place. The clips go inside
 * rather than on the composite because an edge of a clip and an edge of the
 * content crossing one pixel cover its samples together: clip the resolved
 * pixel instead and that pixel comes out as much as 30 levels off.
 *
 * The surface covers only the device pixels the group can paint
 * (`contentBounds`), drawn under the canvas's own projection through a
 * viewport offset by the rect's corner, and composited as a quad over that
 * rect alone. A group that owns a surface of its own draws it, effects
 * and all, into the retained one. Inside a group's effects buffer it composites
 * into that buffer instead, at the same offset.
 */
export function drawRetainedGroup(
  ctx: DrawContext, cmd: GroupDrawCommand, ownsSurface: boolean, dispatch: Dispatch,
): boolean {
  const store = ctx.retained;
  const width = ctx.deviceWidth;
  const height = ctx.deviceHeight;
  if (!store || !width || !height) return false;
  const inScratch = ctx.renderTarget != null && scratchTargets.has(ctx.renderTarget);
  if (inScratch || isOwnComposite(cmd.composite) || readsBackdrop(cmd.children)) {
    store.decline();
    return false;
  }
  const id = cmd.retain!;

  ctx.state.push({ transform: cmd.transform, alpha: cmd.alpha, colorMatrix: cmd.colorMatrix });
  const clips: RetainedClip[] = ctx.clipStack.map(({ path, transform }) => ({ path, transform }));
  if (cmd.clip) clips.push({ path: cmd.clip, transform: ctx.state.transform });
  const key: RetainedKey = {
    children: cmd.children,
    transform: ctx.state.transform,
    alpha: ctx.state.alpha,
    colorMatrix: ctx.state.colorMatrix,
    viewMatrix: ctx.viewMatrix,
    screenMatrix: ctx.screenMatrix,
    clips,
    effects: cmd.effects,
    isolate: cmd.isolate === true,
  };
  // A buffer a group's effects draw in is single-sampled, and so is a
  // surface standing in for drawing into it.
  const multisample = !ctx.renderTarget;
  let pixels = store.lookup(id, width, height, key, multisample);
  if (!pixels) {
    // A group that owns a surface draws it inside this one, under the stack
    // and clips just pushed: its own buffer composites with what it owes.
    const drawn = ownsSurface ? [{ kind: 'group' as const, effects: cmd.effects, isolate: cmd.isolate, children: cmd.children }] : cmd.children;
    const rect = contentBounds(drawn, ctx.state.transform, clips, width / ctx.widthCss, width, height);
    const draw = store.reserve(id, width, height, rect, multisample);
    if (!draw) {
      ctx.state.pop();
      return false;
    }
    // Staged geometry belongs to the buffer underneath.
    flushBatch(ctx);
    if (draw.fbo) drawInto(ctx, drawn, clips, draw.fbo, rect, dispatch);
    pixels = draw.commit(key);
  }
  ctx.state.pop();

  const { texture, rect } = pixels;
  if (!texture) return true;
  flushBatch(ctx);
  const composite = ctx.ensureProgram?.(compositeProgramId()) ?? null;
  if (composite) {
    applyClipTest(ctx, 0);
    const target = ctx.renderTarget ?? null;
    const [ox, oy] = (target ? target.fragOrigin : ctx.fragOrigin) ?? [0, 0];
    ctx.gl.viewport(ox + rect.x, oy + height - rect.y - rect.height, rect.width, rect.height);
    drawFullscreenQuad(ctx, composite, texture, rect.width, rect.height, undefined, COMPOSITE_AS_DRAWN);
    if (!target) ctx.restoreTargetRect?.();
    else if (target.restore) target.restore();
    else ctx.gl.viewport(0, 0, width, height);
  }
  return true;
}

/** Draw `children` into the bottom-left `rect.width × rect.height` of the
 *  scratch buffer behind `fbo`, under the group stack as it stands and inside
 *  `clips`: the part of the drawing buffer `rect` covers. */
function drawInto(
  ctx: DrawContext, children: readonly DrawCommand[], clips: readonly RetainedClip[],
  fbo: WebGLFramebuffer, rect: DeviceRect, dispatch: Dispatch,
): void {
  const gl = ctx.gl;
  const width = ctx.deviceWidth!;
  const height = ctx.deviceHeight!;
  const parentTarget = ctx.renderTarget ?? null;
  const parentClipDepth = ctx.clipDepth;
  const parentClipStack = ctx.clipStack;
  const parentBatchClip = ctx.drawBatch.clip;
  const scissorWasOn = gl.isEnabled(gl.SCISSOR_TEST);
  ctx.clipDepth = 0;
  ctx.clipStack = [];
  ctx.drawBatch.clip = null;
  // The whole drawing buffer's viewport, slid so `rect`'s bottom-left corner
  // lands on the scratch buffer's; the scissor keeps the rest of it out.
  const restore = (): void => {
    gl.viewport(-rect.x, rect.y + rect.height - height, width, height);
    gl.scissor(0, 0, rect.width, rect.height);
    gl.enable(gl.SCISSOR_TEST);
  };
  const target = { fbo, restore, fragOrigin: [-rect.x, rect.y + rect.height - height] as const };
  scratchTargets.add(target);
  ctx.renderTarget = target;

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  restore();
  gl.stencilMask(0xFF);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  for (const clip of clips) enterGroupClip(ctx, clip.path, clip.transform);
  for (const child of children) dispatch(ctx, child);
  flushBatch(ctx);

  ctx.clipDepth = parentClipDepth;
  ctx.clipStack = parentClipStack;
  ctx.drawBatch.clip = parentBatchClip;
  ctx.renderTarget = parentTarget;
  returnToRenderTarget(ctx, width, height, scissorWasOn);
}
