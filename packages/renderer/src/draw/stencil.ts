import type { GpuGeometry, GpuStencilCompare, GpuStencilOp, GpuStencilState } from '../gpu/types';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import type { DrawContext } from './drawContext';
import { drawTriangles } from './drawTriangles';

/*
 * The stencil's bits: bit 0 holds an even-odd fill's or an aligned stroke's
 * parity while it draws, bits 1-7 the clip depths. The states below are the
 * whole set the renderer draws under.
 */

function stencilState(
  compare: GpuStencilCompare, ref: number, readMask: number, writeMask: number, pass: GpuStencilOp,
): GpuStencilState {
  return Object.freeze({ compare, ref, readMask, writeMask, pass });
}

/**
 * Bit-mask for ancestor clip levels.
 * Returns bits 1..depth (inclusive).
 * depth=0 → 0x00; depth=1 → 0x02; depth=3 → 0x0E.
 */
export function ancestorMask(depth: number): number {
  return depth === 0 ? 0 : ((1 << (depth + 1)) - 1) & 0xFE;
}

/** Per depth, built once: every draw names one. */
const CLIP_TESTS: (GpuStencilState | null)[] = Array.from({ length: 8 }, (_, depth) => {
  const mask = ancestorMask(depth);
  return depth === 0 ? null : stencilState('equal', mask, mask, 0xFF, 'keep');
});

/**
 * The stencil test for a draw at clip `depth`: pass where every enclosing
 * clip holds. `null` at depth 0, the zero-overhead common case.
 *
 * Not for `drawPathFillStencil` / `drawPathStrokeStenciled`, which test parity
 * as well; they share the stencil with the clip bits because they use bit 0
 * exclusively.
 */
export function clipTest(depth: number): GpuStencilState | null {
  return CLIP_TESTS[depth];
}

/** Invert bit 0 wherever a fan covers: its parity. */
export const PARITY_WRITE = stencilState('always', 0, 0x01, 0x01, 'invert');

const PARITY_PAINTS: GpuStencilState[] = Array.from({ length: 8 }, (_, depth) => {
  const mask = ancestorMask(depth) | 0x01;
  // A pixel the fan covers three times would blend three times; clearing its
  // parity bit as it paints lets it paint once.
  return stencilState('equal', mask, mask, 0x01, 'invert');
});

/** Paint where the parity is odd and every enclosing clip at `depth` holds. */
export function parityPaint(depth: number): GpuStencilState {
  return PARITY_PAINTS[depth];
}

const TRIM_MARKS: GpuStencilState[] = Array.from({ length: 8 }, (_, depth) => {
  const mask = ancestorMask(depth);
  return stencilState('equal', mask | 0x01, mask, 0x01, 'replace');
});

/** Set bit 0 where every enclosing clip at `depth` holds: what a clipped
 *  trim covers, for `parityPaint` to paint once and clear. */
export function trimMark(depth: number): GpuStencilState {
  return TRIM_MARKS[depth];
}

/** Set a clip's bit where the path covers and its ancestors hold. */
export function clipPush(depth: number, parity: boolean): GpuStencilState {
  const ancestors = ancestorMask(depth - 1);
  const bit = 1 << depth;
  return parity
    ? stencilState('equal', ancestors | bit | 0x01, ancestors | 0x01, bit, 'replace')
    : stencilState('equal', ancestors | bit, ancestors, bit, 'replace');
}

/** Clear the bit of the clip above `depth` where its push set it. */
export function clipPop(depth: number): GpuStencilState {
  const bit = 1 << (depth + 1);
  const ref = ancestorMask(depth) | bit;
  return stencilState('equal', ref, ref, bit, 'zero');
}

/** Mark the fill under an aligned stroke on bit 0: inverted per fan for an
 *  even-odd fill, whose holes only parity cuts, else set. */
export const ALIGNED_FILL = stencilState('always', 1, 0x01, 0x01, 'replace');
export const ALIGNED_FILL_PARITY = stencilState('always', 1, 0x01, 0x01, 'invert');

/** Where an aligned stroke's ribbon paints at clip `depth`: inside the fill
 *  for `inner`, outside it for `outer`. */
export function alignedRibbon(depth: number, inner: boolean): GpuStencilState {
  const clip = ancestorMask(depth);
  return stencilState('equal', inner ? clip | 0x01 : clip, clip | 0x01, 0x01, 'keep');
}

/**
 * Write `geometry`'s even-odd parity to stencil bit 0 and return the state
 * that paints where it is odd and every enclosing clip holds.
 */
export function drawParityMask(
  ctx: DrawContext, program: ShaderProgram, geometry: GpuGeometry, indexCount: number,
): GpuStencilState {
  drawTriangles(ctx, program, geometry, indexCount, { stencil: PARITY_WRITE, colorWrite: false });
  return parityPaint(ctx.clipDepth);
}

/** Zero bit 0 again; the clips own bits 1-7. */
export function endParityMask(ctx: DrawContext): void {
  ctx.gpu.clearStencilBits(0x01);
}
