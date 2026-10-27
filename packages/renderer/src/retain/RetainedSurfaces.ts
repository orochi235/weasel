import { boxWithin, type DeviceBox, type DeviceRect } from './contentBounds';
import { keepKey, keyShift, sameKey, sameStamp, type RetainedKey } from './retainedKey';
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
  /** Samples a pixel of the scratch buffer it was drawn in. */
  samples: number;
  /** For a surface that may stand in for its group moved: everything the
   *  group could paint when drawn, of which `rect` is the part inside
   *  `window`. `null` for one that may not. */
  reach: { box: DeviceBox; window: DeviceRect } | null;
  /** Its group has been drawn moved since the surface was made, so the next
   *  one is drawn with a margin past the buffer. */
  panned: boolean;
  /** The translation its group was last asked for under, CSS pixels. */
  seen: readonly [number, number] | null;
}

/** What `lookup` found: pixels to composite; a surface to draw, covering
 *  what the group paints inside `window`; or that the group should be drawn
 *  straight through this frame, its surface kept for a later one. */
export type RetainedLookup =
  | { kind: 'kept'; pixels: RetainedPixels }
  | { kind: 'redraw'; window: DeviceRect }
  | { kind: 'through' };

/** A shift within this of a whole device pixel draws the same pixels: a
 *  float32 vertex position near 4096 is coarser. */
const WHOLE_PIXEL_SLACK = 1e-4;

/** The margin a surface drawn for a group that pans keeps past each edge of
 *  the buffer, as a fraction of the buffer's side. */
export const PAN_MARGIN = 1 / 8;

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
  /** The rect of the drawing buffer the surface covers. */
  rect: DeviceRect;
  commit(key: RetainedKey): RetainedPixels;
}

/**
 * The textures retained groups keep between frames, one per `retain` id, and
 * the budget they share. Each surface covers only the rect of the drawing
 * buffer its group can paint; a change of the drawing buffer's size drops
 * them all.
 *
 * The budget counts the surfaces, which are what is kept. The scratch buffer
 * they are drawn in is transient: as large as the largest surface it has
 * drawn, so never past one canvas-sized buffer, and freed after the first
 * frame that redraws nothing. Counting it against the budget spent half the
 * default at 4x on a buffer a still frame never touches. A surface composited
 * into a single-sampled buffer is drawn single-sampled, to match what drawing
 * it there leaves, in a second scratch buffer kept the same way.
 *
 * A surface drawn for a group that pans reaches `PAN_MARGIN` past the
 * buffer, so its scratch buffer does too: 1.56 times the buffer's area.
 */
export class RetainedSurfaces {
  private readonly gl: WebGL2RenderingContext;
  private budget: number;
  private readonly samples: number;
  private readonly surfaces = new Map<string, Surface>();
  /** By sample count. Shared: retained draws never nest. */
  private readonly scratches = new Map<number, Scratch>();
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
    let n = this.keptBytes();
    for (const [samples, held] of this.scratches) n += held.width * held.height * Math.max(1, samples) * 8;
    return n;
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

  /**
   * `id`'s pixels if they were drawn under `key`, in a drawing buffer
   * `width × height` device pixels, and sampled as `reserve` would.
   *
   * Given `scale`, the device pixels to the CSS pixel, a surface also stands
   * in for its group moved by a whole number of device pixels while the part
   * of it on the buffer was drawn, and composites that far over. Moved by a
   * fraction of one, the group is drawn straight through and the surface kept
   * until the move holds for a frame; moved out past what was drawn, it is
   * drawn again with a margin past the buffer, `PAN_MARGIN` of a side, or
   * straight through like a fractional move once the budget has refused that
   * margin. Without `scale`, a group moved only by a translation is drawn straight
   * through until the move holds a frame, and then drawn again.
   */
  lookup(
    id: string, width: number, height: number, key: RetainedKey, multisample = true, scale?: number,
  ): RetainedLookup {
    this.fitTo(width, height);
    const buffer = { x: 0, y: 0, width, height };
    const surface = this.surfaces.get(id);
    if (!surface?.key || surface.samples !== (multisample ? this.samples : 0) || !sameStamp(surface.stamp, this.stamp)) {
      return { kind: 'redraw', window: buffer };
    }
    const at = [key.transform[6], key.transform[7]] as const;
    const held = surface.seen !== null && surface.seen[0] === at[0] && surface.seen[1] === at[1];
    if (sameKey(surface.key, key)) {
      surface.frame = this.frame;
      surface.seen = at;
      this.composited++;
      return { kind: 'kept', pixels: pixelsOf(surface, 0, 0) };
    }
    const shift = keyShift(surface.key, key);
    const movable = scale !== undefined && surface.reach !== null;
    const mx = Math.round(width * PAN_MARGIN), my = Math.round(height * PAN_MARGIN);
    const grown = { x: -mx, y: -my, width: width + 2 * mx, height: height + 2 * my };
    if (!shift) return { kind: 'redraw', window: surface.panned && movable ? grown : buffer };
    surface.seen = at;
    surface.frame = this.frame;
    if (!movable) {
      // Moved, and its pixels do not move with it: drawn straight through
      // while the move goes on, as a redraw every frame costs more.
      if (held) return { kind: 'redraw', window: buffer };
      this.declined++;
      return { kind: 'through' };
    }
    // Panned before and still drawn without a margin: the budget refused one,
    // and drawing it again each frame would refuse it again.
    const refused = surface.panned && surface.reach!.window.width === width && surface.reach!.window.height === height;
    surface.panned = true;
    const dx = shift[0] * scale!, dy = shift[1] * scale!;
    const rx = Math.round(dx), ry = Math.round(dy);
    const whole = Math.abs(dx - rx) <= WHOLE_PIXEL_SLACK && Math.abs(dy - ry) <= WHOLE_PIXEL_SLACK;
    if (whole && covers(surface.reach!, rx, ry, width, height)) {
      this.composited++;
      return { kind: 'kept', pixels: pixelsOf(surface, rx, ry) };
    }
    if ((!whole || refused) && !held) {
      this.declined++;
      return { kind: 'through' };
    }
    return { kind: 'redraw', window: grown };
  }

  /** Somewhere to draw `id` this frame, covering `rect` of a drawing buffer
   *  `width × height` device pixels, or `null` when that would take the total
   *  past the budget. Drawn multisampled as the default framebuffer is, or
   *  single-sampled when `multisample` is false. With `reach`, the surface
   *  may stand in for its group moved (see `lookup`); one whose window
   *  reaches past the buffer and does not fit is cut back to the buffer. */
  reserve(
    id: string, width: number, height: number, rect: DeviceRect, multisample = true,
    reach?: { box: DeviceBox; window: DeviceRect },
  ): RetainedDraw | null {
    this.fitTo(width, height);
    const buffer = { x: 0, y: 0, width, height };
    if (reach && (reach.window.width > width || reach.window.height > height) && !this.fits(id, rect)) {
      return this.reserve(id, width, height, boxWithin(reach.box, buffer), multisample, { box: reach.box, window: buffer });
    }
    const existing = this.surfaces.get(id);
    const empty = rect.width === 0 || rect.height === 0;
    const samples = multisample ? this.samples : 0;
    const held = this.scratches.get(samples);
    const scratchW = Math.max(held?.width ?? 0, empty ? 0 : rect.width);
    const scratchH = Math.max(held?.height ?? 0, empty ? 0 : rect.height);
    if (!this.fits(id, rect)) {
      this.declined++;
      return null;
    }
    const surface: Surface = existing ?? {
      gl: null, rect, key: null, stamp: [], frame: this.frame, samples, reach: null, panned: false, seen: null,
    };
    this.surfaces.set(id, surface);
    this.fitSurface(surface, rect);
    surface.frame = this.frame;
    surface.samples = samples;
    this.redrawn++;
    const scratch = surface.gl ? this.scratchFor(samples, scratchW, scratchH) : null;
    return {
      fbo: scratch?.fbo ?? null,
      rect: surface.rect,
      commit: (key) => {
        if (scratch && surface.gl) resolveInto(this.gl, scratch, surface.gl, surface.rect.width, surface.rect.height);
        surface.key = keepKey(key);
        surface.stamp = this.stamp;
        surface.reach = reach ? { box: { ...reach.box }, window: { ...reach.window } } : null;
        surface.seen = [key.transform[6], key.transform[7]];
        return pixelsOf(surface, 0, 0);
      },
    };
  }

  /** Count a group drawn straight through for want of a surface. */
  decline(): void {
    this.declined++;
  }

  /** Free every surface no group asked for this frame, and a scratch buffer
   *  once this frame redrew nothing or it is larger than every surface drawn
   *  in it that is left needs. */
  endFrame(): void {
    const need = new Map<number, { w: number; h: number }>();
    for (const [id, surface] of this.surfaces) {
      if (surface.frame === this.frame) {
        const n = need.get(surface.samples) ?? { w: 0, h: 0 };
        need.set(surface.samples, { w: Math.max(n.w, surface.rect.width), h: Math.max(n.h, surface.rect.height) });
        continue;
      }
      this.deleteSurface(surface);
      this.surfaces.delete(id);
    }
    for (const [samples, held] of this.scratches) {
      const n = need.get(samples) ?? { w: 0, h: 0 };
      if (this.redrawn === 0 || held.width > n.w || held.height > n.h) this.dropScratch(samples);
    }
  }

  /** Drop everything: on dispose, and on context loss, where the handles are
   *  already gone and only the bookkeeping has to go. */
  releaseAll(): void {
    for (const surface of this.surfaces.values()) this.deleteSurface(surface);
    this.surfaces.clear();
    for (const samples of [...this.scratches.keys()]) this.dropScratch(samples);
  }

  private fitTo(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.releaseAll();
    this.width = width;
    this.height = height;
  }

  /** Whether `id` can hold a surface covering `rect` within the budget. */
  private fits(id: string, rect: DeviceRect): boolean {
    const existing = this.surfaces.get(id);
    return this.keptBytes() + rectBytes(rect) - (existing ? rectBytes(existing.rect) : 0) <= this.budget;
  }

  private keptBytes(): number {
    let n = 0;
    for (const surface of this.surfaces.values()) n += rectBytes(surface.rect);
    return n;
  }

  /** The scratch buffer with `samples` at `width × height`, reallocated if
   *  it is not. */
  private scratchFor(samples: number, width: number, height: number): Scratch {
    const held = this.scratches.get(samples);
    if (held && held.width === width && held.height === height) return held;
    this.dropScratch(samples);
    const scratch = createScratch(this.gl, width, height, samples);
    this.scratches.set(samples, scratch);
    return scratch;
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

  private dropScratch(samples: number): void {
    const held = this.scratches.get(samples);
    if (held) deleteScratch(this.gl, held);
    this.scratches.delete(samples);
  }
}

/** `surface`'s pixels, moved `dx, dy` device pixels from where they were drawn. */
function pixelsOf(surface: Surface, dx: number, dy: number): RetainedPixels {
  const { rect } = surface;
  return {
    texture: surface.gl?.texture ?? null,
    rect: dx === 0 && dy === 0 ? rect : { ...rect, x: rect.x + dx, y: rect.y + dy },
  };
}

/** Whether a surface drawn with `reach`, moved `dx, dy` device pixels, holds
 *  every pixel its group paints on a `width × height` buffer. */
function covers(reach: { box: DeviceBox; window: DeviceRect }, dx: number, dy: number, width: number, height: number): boolean {
  const needed = boxWithin(reach.box, { x: -dx, y: -dy, width, height });
  if (needed.width === 0 || needed.height === 0) return true;
  const w = reach.window;
  return needed.x >= w.x && needed.y >= w.y
    && needed.x + needed.width <= w.x + w.width && needed.y + needed.height <= w.y + w.height;
}

function rectBytes(rect: DeviceRect): number {
  return rect.width * rect.height * 4;
}
