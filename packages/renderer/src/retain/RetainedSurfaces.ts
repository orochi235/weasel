import type { DeviceRect } from './contentBounds';
import { keepKey, sameKey, sameStamp, type RetainedKey } from './retainedKey';
import {
  createScratch, createSurfaceTexture, deleteScratch, deleteSurfaceTexture, resolveInto,
  type Scratch, type SurfaceTexture,
} from './surfaceGl';

export type { RetainedClip, RetainedKey } from './retainedKey';

interface Surface {
  /** `null` while `rect` is empty: there are no pixels to keep. */
  gl: SurfaceTexture | null;
  /** The part of the drawing buffer the texture covers, and its size. */
  rect: DeviceRect;
  key: RetainedKey | null;
  stamp: readonly unknown[];
  frame: number;
}

/** A retained group's kept pixels: `texture` covers `rect` of the drawing
 *  buffer, and is `null` when `rect` is empty. */
export interface RetainedPixels {
  texture: WebGLTexture | null;
  rect: DeviceRect;
}

/** A surface about to be drawn: draw into `fbo`, whose bottom-left
 *  `rect.width × rect.height` is kept, then `commit`. `fbo` is `null` when the
 *  rect is empty and there is nothing to draw. */
export interface RetainedDraw {
  fbo: WebGLFramebuffer | null;
  commit(key: RetainedKey): RetainedPixels;
}

/**
 * The textures retained groups keep between frames, one per `retain` id, and
 * the budget they share. Each surface covers only the rect of the drawing
 * buffer its group can paint; a change of the drawing buffer's size drops
 * them all.
 *
 * The budget counts the surfaces, which are what is kept. The multisampled
 * scratch buffer they are drawn in is transient: as large as the largest
 * surface it has drawn, so never past one canvas-sized buffer, and freed
 * after the first frame that redraws nothing. Counting it against the budget
 * spent half the default at 4x on a buffer a still frame never touches.
 */
export class RetainedSurfaces {
  private readonly gl: WebGL2RenderingContext;
  private budget: number;
  private readonly samples: number;
  private readonly surfaces = new Map<string, Surface>();
  /** Shared: retained draws never nest. */
  private scratch: Scratch | null = null;
  private width = 0;
  private height = 0;
  private frame = 0;
  private stamp: readonly unknown[] = [];
  composited = 0;
  redrawn = 0;
  declined = 0;

  constructor(gl: WebGL2RenderingContext, budget: number) {
    this.gl = gl;
    this.budget = budget;
    // The default framebuffer's sample count, read while it is bound.
    const samples: unknown = gl.getParameter(gl.SAMPLES);
    this.samples = typeof samples === 'number' && samples > 1 ? samples : 0;
  }

  /** GPU memory held now, scratch buffer included. */
  get bytes(): number {
    return this.keptBytes() + (this.scratch ? this.scratchBytes(this.scratch.width, this.scratch.height) : 0);
  }

  /** Change the budget. Lowered below what the surfaces hold, every surface
   *  goes, and groups are drawn again within the new one. */
  setBudget(budget: number): void {
    this.budget = budget;
    if (this.keptBytes() > budget) this.releaseAll();
  }

  /** Open a frame. `stamp` holds what every surface depends on beyond its
   *  key — resource generations the renderer watches — compared entry by
   *  entry. */
  beginFrame(stamp: readonly unknown[]): void {
    this.frame++;
    this.stamp = stamp;
    this.composited = 0;
    this.redrawn = 0;
    this.declined = 0;
  }

  /** `id`'s pixels if they were drawn under `key`, in a drawing buffer
   *  `width × height` device pixels. */
  lookup(id: string, width: number, height: number, key: RetainedKey): RetainedPixels | null {
    this.fitTo(width, height);
    const surface = this.surfaces.get(id);
    if (!surface?.key || !sameKey(surface.key, key) || !sameStamp(surface.stamp, this.stamp)) return null;
    surface.frame = this.frame;
    this.composited++;
    return pixelsOf(surface);
  }

  /** Somewhere to draw `id` this frame, covering `rect` of a drawing buffer
   *  `width × height` device pixels, or `null` when that would take the total
   *  past the budget. */
  reserve(id: string, width: number, height: number, rect: DeviceRect): RetainedDraw | null {
    this.fitTo(width, height);
    const existing = this.surfaces.get(id);
    const empty = rect.width === 0 || rect.height === 0;
    const held = this.scratch;
    const scratchW = Math.max(held?.width ?? 0, empty ? 0 : rect.width);
    const scratchH = Math.max(held?.height ?? 0, empty ? 0 : rect.height);
    const after = this.keptBytes() + rectBytes(rect) - (existing ? rectBytes(existing.rect) : 0);
    if (after > this.budget) {
      this.declined++;
      return null;
    }
    const surface = existing ?? { gl: null, rect, key: null, stamp: [], frame: this.frame };
    this.surfaces.set(id, surface);
    this.fitSurface(surface, rect);
    surface.frame = this.frame;
    this.redrawn++;
    const scratch = surface.gl ? this.scratchFor(scratchW, scratchH) : null;
    return {
      fbo: scratch?.fbo ?? null,
      commit: (key) => {
        if (scratch && surface.gl) resolveInto(this.gl, scratch, surface.gl, surface.rect.width, surface.rect.height);
        surface.key = keepKey(key);
        surface.stamp = this.stamp;
        return pixelsOf(surface);
      },
    };
  }

  /** Count a group drawn straight through for want of a surface. */
  decline(): void {
    this.declined++;
  }

  /** Free every surface no group asked for this frame, and the scratch
   *  buffer once this frame redrew nothing or it is larger than every surface
   *  left needs. */
  endFrame(): void {
    let needW = 0;
    let needH = 0;
    for (const [id, surface] of this.surfaces) {
      if (surface.frame === this.frame) {
        needW = Math.max(needW, surface.rect.width);
        needH = Math.max(needH, surface.rect.height);
        continue;
      }
      this.deleteSurface(surface);
      this.surfaces.delete(id);
    }
    const oversized = this.scratch && (this.scratch.width > needW || this.scratch.height > needH);
    if (this.redrawn === 0 || oversized) this.dropScratch();
  }

  /** Drop everything: on dispose, and on context loss, where the handles are
   *  already gone and only the bookkeeping has to go. */
  releaseAll(): void {
    for (const surface of this.surfaces.values()) this.deleteSurface(surface);
    this.surfaces.clear();
    this.dropScratch();
  }

  private fitTo(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.releaseAll();
    this.width = width;
    this.height = height;
  }

  private keptBytes(): number {
    let n = 0;
    for (const surface of this.surfaces.values()) n += rectBytes(surface.rect);
    return n;
  }

  private scratchBytes(width: number, height: number): number {
    return width * height * Math.max(1, this.samples) * 8;
  }

  /** The scratch buffer at `width × height`, reallocated if it is not. */
  private scratchFor(width: number, height: number): Scratch {
    const held = this.scratch;
    if (held && held.width === width && held.height === height) return held;
    this.dropScratch();
    return (this.scratch = createScratch(this.gl, width, height, this.samples));
  }

  /** Give `surface` a texture the size of `rect`, or none for an empty one,
   *  keeping one that is already that size. */
  private fitSurface(surface: Surface, rect: DeviceRect): void {
    const was = surface.rect;
    surface.rect = { ...rect };
    if (surface.gl && was.width === rect.width && was.height === rect.height) return;
    this.deleteSurface(surface);
    if (rect.width > 0 && rect.height > 0) surface.gl = createSurfaceTexture(this.gl, rect.width, rect.height);
  }

  private deleteSurface(surface: Surface): void {
    if (surface.gl) deleteSurfaceTexture(this.gl, surface.gl);
    surface.gl = null;
  }

  private dropScratch(): void {
    if (this.scratch) deleteScratch(this.gl, this.scratch);
    this.scratch = null;
  }
}

function pixelsOf(surface: Surface): RetainedPixels {
  return { texture: surface.gl?.texture ?? null, rect: surface.rect };
}

function rectBytes(rect: DeviceRect): number {
  return rect.width * rect.height * 4;
}
