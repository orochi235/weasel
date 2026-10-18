import type { DrawCommand, GroupDrawCommand } from '../DrawCommand';
import { compositeProgramId } from '../effects/composite';
import { isOwnComposite } from '../effects/compositeOp';
import { IDENTITY_COLOR_MATRIX } from '../state/GroupState';
import type { RetainedClip, RetainedKey } from '../retain/RetainedSurfaces';
import type { DrawContext } from './drawContext';
import { drawFullscreenQuad, returnToRenderTarget } from './effects';
import { applyClipTest } from './stencil';
import { enterGroupClip } from './clip';
import { flushBatch } from './flushBatch';

type Dispatch = (ctx: DrawContext, cmd: DrawCommand) => void;

const COMPOSITE_AS_DRAWN = { alpha: 1, colorMatrix: IDENTITY_COLOR_MATRIX };

/** Whether a tree reads only its own pixels, keyed by children array. Arrays
 *  a retained group draws are immutable, so the answer holds for good. */
const ownPixelsOnly = new WeakMap<readonly DrawCommand[], boolean>();

function readsOnlyOwnPixels(children: readonly DrawCommand[]): boolean {
  const known = ownPixelsOnly.get(children);
  if (known !== undefined) return known;
  let ok = true;
  for (const child of children) {
    if (child.kind !== 'group') continue;
    if (isOwnComposite(child.composite) || !readsOnlyOwnPixels(child.children)) {
      ok = false;
      break;
    }
  }
  ownPixelsOnly.set(children, ok);
  return ok;
}

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
 */
export function drawRetainedGroup(
  ctx: DrawContext, cmd: GroupDrawCommand, ownsSurface: boolean, dispatch: Dispatch,
): boolean {
  const store = ctx.retained;
  const width = ctx.deviceWidth;
  const height = ctx.deviceHeight;
  if (!store || !width || !height) return false;
  if (ownsSurface || ctx.renderTarget || !readsOnlyOwnPixels(cmd.children)) {
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
    clips,
  };
  let texture = store.lookup(id, width, height, key);
  if (!texture) {
    const draw = store.reserve(id, width, height);
    if (!draw) {
      ctx.state.pop();
      return false;
    }
    // Staged geometry belongs to the buffer underneath.
    flushBatch(ctx);
    drawInto(ctx, cmd.children, clips, draw.fbo, width, height, dispatch);
    texture = draw.commit(key);
  }
  ctx.state.pop();

  flushBatch(ctx);
  const composite = ctx.ensureProgram?.(compositeProgramId()) ?? null;
  if (composite) {
    applyClipTest(ctx, 0);
    drawFullscreenQuad(ctx, composite, texture, width, height, undefined, COMPOSITE_AS_DRAWN);
  }
  return true;
}

/** Draw `children` into the scratch buffer behind `fbo`, under the group
 *  stack as it stands and inside `clips`. */
function drawInto(
  ctx: DrawContext, children: readonly DrawCommand[], clips: readonly RetainedClip[],
  fbo: WebGLFramebuffer, width: number, height: number, dispatch: Dispatch,
): void {
  const gl = ctx.gl;
  const parentClipDepth = ctx.clipDepth;
  const parentClipStack = ctx.clipStack;
  const parentBatchClip = ctx.drawBatch.clip;
  const scissorWasOn = gl.isEnabled(gl.SCISSOR_TEST);
  ctx.clipDepth = 0;
  ctx.clipStack = [];
  ctx.drawBatch.clip = null;
  ctx.renderTarget = { fbo };

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, width, height);
  gl.disable(gl.SCISSOR_TEST);
  gl.stencilMask(0xFF);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  for (const clip of clips) enterGroupClip(ctx, clip.path, clip.transform);
  for (const child of children) dispatch(ctx, child);
  flushBatch(ctx);

  ctx.clipDepth = parentClipDepth;
  ctx.clipStack = parentClipStack;
  ctx.drawBatch.clip = parentBatchClip;
  ctx.renderTarget = null;
  returnToRenderTarget(ctx, width, height, scissorWasOn);
}
