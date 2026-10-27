import { mat3, type Path, type GlMat3 } from '@weasel-js/geom';
import { axisAlignedClipRect, intersectClipRects, type ClipRect } from '../batchClip';
import { concatHulls, hullOf, windowMap, type Hull, type HullSet } from '../batchHull';
import type { ClipEntry, DrawContext } from './drawContext';
import { drawTriangles } from './drawTriangles';
import { fillMeshHandle } from './mesh';
import { projFor, setProjAndModel } from './uniforms';
import { ancestorMask } from './stencil';
import { flushBatch } from './flushBatch';

/** `enterClip` for a group command, refusing one past the stencil's budget. */
export function enterGroupClip(ctx: DrawContext, clip: Path, transform: GlMat3 = ctx.state.transform): void {
  const pending = ctx.clipStack.reduce((n, e) => n + (e.depth === 0 ? 1 : 0), 0);
  if (ctx.clipDepth + pending + 1 > 7) {
    throw new Error(
      'weasel: clip nesting depth exceeded (max 7). You can\'t nest more than 7 levels ' +
      'of clipped containers in a single draw tree. Flatten the hierarchy or compose ' +
      'poses outside the scene graph.',
    );
  }
  enterClip(ctx, clip, transform);
}

const IDENTITY = mat3.identity();

/**
 * Push a group's clip. A clip only the stencil can express takes its bit now.
 * An axis-aligned rect takes none: staged geometry is cut to it on the CPU, so
 * content inside it joins the run outside it. Nor does a convex clip the batch
 * shader decides (`batchHull.ts`). Either takes a bit only if something that
 * draws for itself turns up inside it — see `flushForOwnDraw`.
 */
function enterClip(ctx: DrawContext, path: Path, transform: GlMat3): void {
  const rect = axisAlignedClipRect(path, transform);
  const below = liveHulls(ctx);
  const hull = rect === null ? hullFor(ctx, path, transform) : null;
  const hulls = hull && (below ? concatHulls(below, hull.set) : hull.set);
  if (rect !== null) {
    ctx.clipStack.push({ path, transform, rect, hull: null, hulls: below, depth: 0 });
  } else if (hull && hulls) {
    ctx.clipStack.push({ path, transform, rect: null, hull, hulls, depth: 0 });
  } else {
    // Bits nest in stack order, so any clip still without one takes it first.
    materializeClips(ctx);
    const depth = ctx.clipDepth + 1;
    pushClip(ctx, path, depth, transform);
    ctx.clipDepth = depth;
    ctx.clipStack.push({ path, transform, rect: null, hull: null, hulls: below, depth });
  }
  syncBatchClip(ctx);
}

/** `path` under `transform` as a hull, where this target can decide one in
 *  the shader exactly: the default framebuffer, single-sampled. */
function hullFor(ctx: DrawContext, path: Path, transform: GlMat3): Hull | null {
  if (!ctx.batchVariants?.hulls || ctx.renderTarget || ctx.projection) return null;
  if (ctx.deviceWidth === undefined || ctx.deviceHeight === undefined) return null;
  const map = windowMap(projFor(ctx), ctx.fragOrigin ?? [0, 0], ctx.deviceWidth, ctx.deviceHeight);
  return hullOf(path, transform, map);
}

/** The hulls a vertex staged now is tested against. */
export function liveHulls(ctx: DrawContext): HullSet | null {
  const stack = ctx.clipStack;
  return stack.length === 0 ? null : stack[stack.length - 1].hulls;
}

export function leaveClip(ctx: DrawContext): void {
  const entry = ctx.clipStack.pop()!;
  if (entry.depth > 0) {
    popClip(ctx, stencilPath(entry), entry.depth - 1, stencilTransform(entry));
    ctx.clipDepth = entry.depth - 1;
  }
  syncBatchClip(ctx);
}

/** What the stencil draws for a clip: a hull's snapped polygon, so it covers
 *  the pixels the shader keeps; anything else as it came. */
function stencilPath(entry: ClipEntry): Path {
  return entry.hull ? entry.hull.path : entry.path;
}

function stencilTransform(entry: ClipEntry): GlMat3 {
  return entry.hull ? IDENTITY : entry.transform;
}

/** Give every rect and hull clip on the stack its stencil bit, for a draw
 *  neither the CPU cut nor the batch shader reaches. */
function materializeClips(ctx: DrawContext): void {
  for (const entry of ctx.clipStack) {
    if (entry.depth !== 0) continue;
    const depth = ctx.clipDepth + 1;
    pushClip(ctx, stencilPath(entry), depth, stencilTransform(entry));
    entry.depth = depth;
    ctx.clipDepth = depth;
  }
}

function syncBatchClip(ctx: DrawContext): void {
  let rect: ClipRect | null = null;
  for (const entry of ctx.clipStack) {
    if (entry.rect) rect = rect ? intersectClipRects(rect, entry.rect) : entry.rect;
  }
  ctx.drawBatch.clip = rect;
}

/**
 * The clip depth a run is staged and drawn at: the innermost clip only the
 * stencil can express. Rect and hull clips are left out whether or not they
 * hold a bit, because the CPU cut or the shader already applies them — which
 * is what lets a run cross them.
 */
export function runClipDepth(ctx: DrawContext): number {
  const stack = ctx.clipStack;
  if (stack.length === 0 || ctx.uncut) return ctx.clipDepth;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].rect === null && stack[i].hull === null) return stack[i].depth;
  }
  // Only rect and hull clips: whatever depth held before the first of them
  // took a bit.
  for (const entry of stack) if (entry.depth > 0) return entry.depth - 1;
  return ctx.clipDepth;
}

/**
 * Put the rect clips on the stencil and stop cutting, for an item the batch
 * refused to cut — one with a slanted edge across a clip (see
 * `DrawBatch.clipQuad`). Staged again between this and `leaveUncut`, the item
 * sees the full stencil depth and lands in a run of its own under every clip.
 * Returns the cut to hand back. A pair rather than a callback: the staging
 * paths are hot, and a closure would cost an allocation on every call.
 */
export function enterUncut(ctx: DrawContext): ClipRect | null {
  materializeClips(ctx);
  const cut = ctx.drawBatch.clip;
  ctx.drawBatch.clip = null;
  ctx.uncut = true;
  return cut;
}

export function leaveUncut(ctx: DrawContext, cut: ClipRect | null): void {
  ctx.drawBatch.clip = cut;
  ctx.uncut = false;
}

/** `fn(ctx, a, b)` again, uncut — for the stage-and-push helpers, which pass
 *  themselves. */
export function retryUncut<A, B>(
  ctx: DrawContext, a: A, b: B, fn: (ctx: DrawContext, a: A, b: B) => void,
): void {
  const cut = enterUncut(ctx);
  fn(ctx, a, b);
  leaveUncut(ctx, cut);
}

/**
 * Drain the run before a draw that does not go through it, and give that draw
 * the stencil it tests against. Every such draw starts here or behind a
 * `tryStageFill` that returned `false`, which ends the same way.
 */
export function flushForOwnDraw(ctx: DrawContext): void {
  flushBatch(ctx);
  if (ctx.clipStack.length > 0) materializeClips(ctx);
}

/**
 * Rasterize a path into the stencil buffer. The caller sets stencilFunc /
 * stencilOp / stencilMask and colorMask before calling.
 */
function rasterizePathToStencil(ctx: DrawContext, path: Path, model: GlMat3): void {
  const gl = ctx.gl;
  const handle = fillMeshHandle(ctx, path);
  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.pathFill, model);
  drawTriangles(ctx, handle.indexCount, ctx.gl.UNSIGNED_INT);
  gl.bindVertexArray(null);
}

/**
 * Push a clip level: sets stencil bit `newDepth` where the path covers and all
 * ancestor clip bits are already set. Restores stencilMask(0xFF) on exit.
 */
export function pushClip(
  ctx: DrawContext, path: Path, newDepth: number, model: GlMat3 = ctx.state.transform,
): void {
  // First, not last: a run staged outside the clip would otherwise draw under
  // a mask it never had.
  flushBatch(ctx);
  const gl = ctx.gl;
  const ancestors = ancestorMask(newDepth - 1);
  const newBit = 1 << newDepth;
  const ref = ancestors | newBit;

  gl.enable(gl.STENCIL_TEST);
  gl.colorMask(false, false, false, false);
  if (fillMeshHandle(ctx, path).requiresStencil) {
    // Fans, one per contour: their union is not the path. Parity goes on
    // bit 0, the clip bit is written where parity is odd, and drawing the
    // fans a third time returns bit 0 to zero.
    gl.stencilMask(0x01);
    gl.stencilFunc(gl.ALWAYS, 0, 0x01);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
    rasterizePathToStencil(ctx, path, model);
    gl.stencilMask(newBit);
    gl.stencilFunc(gl.EQUAL, ref | 0x01, ancestors | 0x01);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    rasterizePathToStencil(ctx, path, model);
    gl.stencilMask(0x01);
    gl.stencilFunc(gl.ALWAYS, 0, 0x01);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
    rasterizePathToStencil(ctx, path, model);
  } else {
    gl.stencilMask(newBit);
    gl.stencilFunc(gl.EQUAL, ref, ancestors);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    rasterizePathToStencil(ctx, path, model);
  }

  gl.colorMask(true, true, true, true);
  // Restore full mask so subsequent draw functions don't inherit a narrowed mask.
  gl.stencilMask(0xFF);
}

/**
 * Pop a clip level: rasterizes the same path again, clearing bit
 * `oldDepth + 1` where the matching push set it. Restores stencilMask(0xFF)
 * on exit.
 */
export function popClip(
  ctx: DrawContext, path: Path, oldDepth: number, model: GlMat3 = ctx.state.transform,
): void {
  // First, not last: past here the mask is gone, and these pixels belonged
  // inside it. A run staged below this bit does not test it, so it lives on.
  if (ctx.batchState !== undefined && ctx.batchState.clipDepth > oldDepth) flushBatch(ctx);
  const gl = ctx.gl;
  // Re-enable stencil: child draw functions (evenodd/stenciled-stroke) disable
  // it at their end; we must set it before writing the clear pass.
  gl.enable(gl.STENCIL_TEST);

  const oldBit = 1 << (oldDepth + 1);
  const ref = ancestorMask(oldDepth) | oldBit;

  gl.colorMask(false, false, false, false);
  gl.stencilMask(oldBit);
  gl.stencilFunc(gl.EQUAL, ref, ref);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);

  rasterizePathToStencil(ctx, path, model);

  gl.colorMask(true, true, true, true);
  // Restore full mask so subsequent draw functions don't inherit a narrowed mask.
  gl.stencilMask(0xFF);
}
