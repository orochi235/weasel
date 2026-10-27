/**
 * Offscreen color buffers for effect passes, pooled per renderer by size.
 * Nothing is allocated until a group with effects asks for one. A group's
 * buffer covers only what its effects read and change inside the target it
 * joins (`effectsWindow`), so sizes vary from group to group; a size no group
 * borrowed in a frame is freed at the start of the next.
 *
 * Clips and even-odd fills live in the stencil buffer, and an FBO does not
 * inherit the default framebuffer's — one without its own attachment renders
 * even-odd paths with their holes filled and clips that do not clip, with no
 * GL error. Every target here gets a DEPTH24_STENCIL8 renderbuffer of its own.
 */

export interface EffectTarget {
  readonly fbo: WebGLFramebuffer;
  readonly texture: WebGLTexture;
  readonly width: number;
  readonly height: number;
  /** @internal — the pool's own bookkeeping. */
  readonly stencil: WebGLRenderbuffer;
}

interface Pooled extends EffectTarget {
  /** Borrowed since the last `reclaim`. */
  used: boolean;
}

export class EffectTargets {
  private readonly gl: WebGL2RenderingContext;
  private all: Pooled[] = [];
  private free: Pooled[] = [];

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /** True once anything has been allocated — what a test asks instead of
   *  reaching for the private arrays. */
  get allocated(): boolean {
    return this.all.length > 0;
  }

  /** Borrow a target sized `width` × `height` device pixels. */
  acquire(width: number, height: number): EffectTarget {
    const i = this.free.findIndex((t) => t.width === width && t.height === height);
    const target = i >= 0 ? this.free.splice(i, 1)[0] : this.create(width, height);
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
      else this.destroy(t);
      t.used = false;
    }
    this.all = kept;
    this.free = [...kept];
  }

  /** Drop every buffer. Called on dispose and on context loss, where the
   *  handles are already invalid and only the bookkeeping has to go. */
  releaseAll(): void {
    for (const t of this.all) this.destroy(t);
    this.all = [];
    this.free = [];
  }

  private destroy(t: Pooled): void {
    const gl = this.gl;
    gl.deleteFramebuffer(t.fbo);
    gl.deleteTexture(t.texture);
    gl.deleteRenderbuffer(t.stencil);
  }

  private create(width: number, height: number): Pooled {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // CLAMP_TO_EDGE so a kernel reaching past the edge repeats the border
    // instead of wrapping the opposite side of the buffer into frame.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    const stencil = gl.createRenderbuffer()!;
    gl.bindRenderbuffer(gl.RENDERBUFFER, stencil);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, width, height);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencil);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const made: Pooled = { fbo, texture, stencil, width, height, used: false };
    this.all.push(made);
    return made;
  }
}
