/**
 * The offscreen color buffer a registered paint kind renders into when what it
 * fills is not a path: atlas glyphs, whose coverage then masks what it drew.
 *
 * One per renderer, grown in powers of two to the largest region asked of it
 * and never shrunk, so a frame of differently sized text groups reallocates a
 * few times and then not at all. The region is clamped to the drawing buffer,
 * which bounds the buffer too. It has no stencil: nothing drawn into it is
 * clipped — the clip applies to the glyphs sampling it.
 */

import type { GpuDevice, GpuTarget } from './gpu/types';

export interface PaintScratchTarget {
  /** Its color, sampled NEAREST: the region is laid on the device-pixel grid,
   *  so every fragment reading it lands on a texel center and NEAREST is exact. */
  readonly target: GpuTarget;
  /** Texture size, at least the region asked for. */
  readonly width: number;
  readonly height: number;
}

const MIN_SIDE = 64;

export class PaintScratch {
  private target: PaintScratchTarget | null = null;

  constructor(private readonly gpu: GpuDevice) {}

  /** A buffer at least `width` × `height` device pixels. Its contents are
   *  whatever the last user left; the caller clears the region it uses. */
  acquire(width: number, height: number): PaintScratchTarget {
    const have = this.target;
    if (have && have.width >= width && have.height >= height) return have;
    const w = Math.max(have?.width ?? 0, pow2(width));
    const h = Math.max(have?.height ?? 0, pow2(height));
    this.release();
    this.target = { target: this.gpu.createTarget({ width: w, height: h, filter: 'nearest' }), width: w, height: h };
    return this.target;
  }

  /** Drop the buffer. Called on dispose and on context restore, where the
   *  handles are already dead and only the bookkeeping has to go. */
  release(): void {
    if (!this.target) return;
    this.gpu.deleteTarget(this.target.target);
    this.target = null;
  }
}

function pow2(n: number): number {
  let side = MIN_SIDE;
  while (side < n) side *= 2;
  return side;
}
