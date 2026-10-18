import type { GlMat3, Path } from '@weasel-js/geom';
import type { DrawCommand } from '../DrawCommand';

/** Everything a retained group's pixels were drawn under. Two keys that
 *  compare equal draw the same pixels. */
export interface RetainedKey {
  children: readonly DrawCommand[];
  transform: GlMat3;
  alpha: number;
  colorMatrix: Float32Array;
  viewMatrix: GlMat3 | undefined;
  /** Every clip enclosing the group, outermost first, its own last. */
  clips: readonly RetainedClip[];
}

/** A clip path and the transform it is in. */
export interface RetainedClip {
  path: Path;
  transform: GlMat3;
}

interface Surface {
  texture: WebGLTexture;
  /** Reads nothing; the resolve blit's destination. */
  fbo: WebGLFramebuffer;
  key: RetainedKey | null;
  stamp: readonly unknown[];
  frame: number;
}

/** The multisampled buffer every retained group is drawn in before it is
 *  resolved into its own texture, so its edges match what drawing it on the
 *  canvas would have produced. One, shared: retained draws never nest. */
interface Scratch {
  fbo: WebGLFramebuffer;
  color: WebGLRenderbuffer;
  stencil: WebGLRenderbuffer;
}

/** A surface about to be drawn: draw into `fbo`, then `commit`. */
export interface RetainedDraw {
  fbo: WebGLFramebuffer;
  commit(key: RetainedKey): WebGLTexture;
}

/**
 * The textures retained groups keep between frames, one per `retain` id, and
 * the budget they share. Every surface is the size of the drawing buffer; a
 * change of size drops them all.
 */
export class RetainedSurfaces {
  private readonly gl: WebGL2RenderingContext;
  private readonly budget: number;
  private readonly samples: number;
  private readonly surfaces = new Map<string, Surface>();
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
    if (this.surfaces.size === 0 && !this.scratch) return 0;
    return this.surfaces.size * this.surfaceBytes() + this.scratchBytes();
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

  /** The texture holding `id`'s pixels if they were drawn under `key`. */
  lookup(id: string, width: number, height: number, key: RetainedKey): WebGLTexture | null {
    this.fitTo(width, height);
    const surface = this.surfaces.get(id);
    if (!surface?.key || !sameKey(surface.key, key) || !sameStamp(surface.stamp, this.stamp)) return null;
    surface.frame = this.frame;
    this.composited++;
    return surface.texture;
  }

  /** Somewhere to draw `id` this frame, or `null` when that would take the
   *  total past the budget. */
  reserve(id: string, width: number, height: number): RetainedDraw | null {
    this.fitTo(width, height);
    const existing = this.surfaces.get(id);
    const after = (this.surfaces.size + (existing ? 0 : 1)) * this.surfaceBytes() + this.scratchBytes();
    if (after > this.budget) {
      this.declined++;
      return null;
    }
    const scratch = this.scratch ?? (this.scratch = this.createScratch());
    const surface = existing ?? this.createSurface();
    this.surfaces.set(id, surface);
    surface.frame = this.frame;
    this.redrawn++;
    return {
      fbo: scratch.fbo,
      commit: (key) => {
        this.resolve(scratch, surface);
        surface.key = {
          ...key,
          transform: key.transform.slice(),
          colorMatrix: key.colorMatrix.slice(),
          viewMatrix: key.viewMatrix?.slice(),
          clips: key.clips.map((c) => ({ path: c.path, transform: c.transform.slice() })),
        };
        surface.stamp = this.stamp;
        return surface.texture;
      },
    };
  }

  /** Count a group drawn straight through for want of a surface. */
  decline(): void {
    this.declined++;
  }

  /** Free every surface no group asked for this frame, and the scratch
   *  buffer once none is left. */
  endFrame(): void {
    for (const [id, surface] of this.surfaces) {
      if (surface.frame === this.frame) continue;
      this.deleteSurface(surface);
      this.surfaces.delete(id);
    }
    if (this.surfaces.size === 0) this.deleteScratch();
  }

  /** Drop everything: on dispose, and on context loss, where the handles are
   *  already gone and only the bookkeeping has to go. */
  releaseAll(): void {
    for (const surface of this.surfaces.values()) this.deleteSurface(surface);
    this.surfaces.clear();
    this.deleteScratch();
  }

  private fitTo(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.releaseAll();
    this.width = width;
    this.height = height;
  }

  private surfaceBytes(): number {
    return this.width * this.height * 4;
  }

  private scratchBytes(): number {
    return this.width * this.height * Math.max(1, this.samples) * 8;
  }

  private resolve(scratch: Scratch, surface: Surface): void {
    const gl = this.gl;
    const scissor = gl.isEnabled(gl.SCISSOR_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, scratch.fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, surface.fbo);
    gl.blitFramebuffer(
      0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT, gl.NEAREST,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (scissor) gl.enable(gl.SCISSOR_TEST);
  }

  private createSurface(): Surface {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // One texel per device pixel, sampled at its center: nothing to filter.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { texture, fbo, key: null, stamp: [], frame: this.frame };
  }

  private createScratch(): Scratch {
    const gl = this.gl;
    const storage = (format: number): WebGLRenderbuffer => {
      const rb = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      if (this.samples > 0) {
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, format, this.width, this.height);
      } else {
        gl.renderbufferStorage(gl.RENDERBUFFER, format, this.width, this.height);
      }
      return rb;
    };
    const color = storage(gl.RGBA8);
    const stencil = storage(gl.DEPTH24_STENCIL8);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencil);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, color, stencil };
  }

  private deleteSurface(surface: Surface): void {
    this.gl.deleteFramebuffer(surface.fbo);
    this.gl.deleteTexture(surface.texture);
  }

  private deleteScratch(): void {
    if (!this.scratch) return;
    const gl = this.gl;
    gl.deleteFramebuffer(this.scratch.fbo);
    gl.deleteRenderbuffer(this.scratch.color);
    gl.deleteRenderbuffer(this.scratch.stencil);
    this.scratch = null;
  }
}

function sameKey(a: RetainedKey, b: RetainedKey): boolean {
  return a.children === b.children && a.alpha === b.alpha
    && sameFloats(a.transform, b.transform) && sameFloats(a.colorMatrix, b.colorMatrix)
    && (a.viewMatrix === undefined ? b.viewMatrix === undefined
      : b.viewMatrix !== undefined && sameFloats(a.viewMatrix, b.viewMatrix))
    && sameClips(a.clips, b.clips);
}

function sameClips(a: readonly RetainedClip[], b: readonly RetainedClip[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].path !== b[i].path || !sameFloats(a[i].transform, b[i].transform)) return false;
  }
  return true;
}

function sameFloats(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sameStamp(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}
