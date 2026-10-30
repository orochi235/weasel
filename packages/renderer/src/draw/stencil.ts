import type { DrawContext } from './drawContext';
import { drawTriangles } from './drawTriangles';

// ─── Per-fragment clip test ───────────────────────────────────────────────────

/**
 * Set the stencil test for the current clip depth. Called by every
 * fragment-producing draw before its drawElements call when clipDepth > 0.
 * At clipDepth = 0, disables STENCIL_TEST (zero-overhead common case).
 *
 * Note: not called by drawPathFillStencil / drawPathStrokeStenciled, which
 * manage their own stencil state (evenodd / inner-outer stencil). Those paths
 * coexist with clip bits because they use bit 0 exclusively while clip levels
 * occupy bits 1-7.
 */
export function applyClipTest(ctx: DrawContext, depth: number = ctx.clipDepth): void {
  const gl = ctx.gl;
  if (depth === 0) {
    gl.disable(gl.STENCIL_TEST);
    return;
  }
  const mask = ancestorMask(depth);
  gl.enable(gl.STENCIL_TEST);
  gl.stencilFunc(gl.EQUAL, mask, mask);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
}

// ─── Clip-stencil helpers ────────────────────────────────────────────────────

/**
 * Bit-mask for ancestor clip levels.
 * Returns bits 1..depth (inclusive).
 * depth=0 → 0x00; depth=1 → 0x02; depth=3 → 0x0E.
 */
export function ancestorMask(depth: number): number {
  return depth === 0 ? 0 : ((1 << (depth + 1)) - 1) & 0xFE;
}

/**
 * Write the bound even-odd mesh's parity to stencil bit 0, then leave the
 * test passing where that parity is odd and every enclosing clip holds. The
 * program, VAO, and model are the caller's, already bound.
 */
export function beginParityMask(ctx: DrawContext, indexCount: number): void {
  const gl = ctx.gl;
  gl.enable(gl.STENCIL_TEST);
  gl.colorMask(false, false, false, false);
  gl.stencilMask(0x01);
  gl.stencilFunc(gl.ALWAYS, 0, 0x01);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
  drawTriangles(ctx, indexCount, ctx.gl.UNSIGNED_INT);

  const clipMask = ancestorMask(ctx.clipDepth);
  gl.colorMask(true, true, true, true);
  gl.stencilFunc(gl.EQUAL, clipMask | 0x01, clipMask | 0x01);
  // A pixel the fan covers three times would blend three times; clearing its
  // parity bit as it paints lets it paint once.
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
}

export function endParityMask(ctx: DrawContext): void {
  const gl = ctx.gl;
  // Narrow to bit 0 first: clear only zeroes bits the mask enables, and
  // pushClip owns bits 1-7.
  gl.stencilMask(0x01);
  gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.disable(gl.STENCIL_TEST);
}
