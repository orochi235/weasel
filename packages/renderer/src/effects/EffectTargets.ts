/**
 * Offscreen color buffers for effect passes, pooled per renderer by size.
 * Nothing is allocated until a group with effects asks for one. A group's
 * buffer covers only what its effects read and change inside the target it
 * joins (`effectsWindow`), so sizes vary from group to group; a size no group
 * borrowed in a frame is freed at the start of the next.
 *
 * Clips and even-odd fills live in the stencil buffer, and an offscreen target
 * does not share the canvas's, so every target here has a stencil of its own.
 *
 * An id frame's targets also hold an id attachment (`ids`), drawn to beside
 * the color; one asked for with ids is never handed out for one without.
 */

import type { GpuDevice, GpuTarget } from '../gpu/types';

export interface EffectTarget {
  /** Its color, sampled bilinear, and its id attachment for a target
   *  acquired with ids. */
  readonly target: GpuTarget;
  readonly width: number;
  readonly height: number;
}

interface Pooled extends EffectTarget {
  /** Borrowed since the last `reclaim`. */
  used: boolean;
}

export class EffectTargets {
  private all: Pooled[] = [];
  private free: Pooled[] = [];

  constructor(private readonly gpu: GpuDevice) {}

  /** True once anything has been allocated — what a test asks instead of
   *  reaching for the private arrays. */
  get allocated(): boolean {
    return this.all.length > 0;
  }

  /** Borrow a target sized `width` × `height` device pixels, with an id
   *  attachment when `ids` is set. */
  acquire(width: number, height: number, ids = false): EffectTarget {
    const i = this.free.findIndex((t) => t.width === width && t.height === height && (t.target.ids !== null) === ids);
    const target = i >= 0 ? this.free.splice(i, 1)[0] : this.create(width, height, ids);
    target.used = true;
    return target;
  }

  /** Hand one back. */
  release(target: EffectTarget): void {
    this.free.push(target as Pooled);
  }

  /** At the start of a frame: take back every target still out on loan — a
   *  frame that threw inside a group with effects never released the one it
   *  was drawing into — and free every one the last frame did not borrow. */
  reclaim(): void {
    const kept: Pooled[] = [];
    for (const t of this.all) {
      if (t.used) kept.push(t);
      else this.gpu.deleteTarget(t.target);
      t.used = false;
    }
    this.all = kept;
    this.free = [...kept];
  }

  /** Drop every buffer. Called on dispose and on context loss, where the
   *  handles are already invalid and only the bookkeeping has to go. */
  releaseAll(): void {
    for (const t of this.all) this.gpu.deleteTarget(t.target);
    this.all = [];
    this.free = [];
  }

  private create(width: number, height: number, ids: boolean): Pooled {
    const target = this.gpu.createTarget({ width, height, stencil: true, ids, filter: 'linear' });
    const made: Pooled = { target, width, height, used: false };
    this.all.push(made);
    return made;
  }
}
