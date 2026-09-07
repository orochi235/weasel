/**
 * Offscreen colour buffers for effect passes, pooled per renderer.
 *
 * Nothing is allocated until a group with effects asks for one, so a canvas
 * with no effects pays nothing — which is the whole cost story for a feature
 * that would otherwise carry a device-resolution buffer per frame.
 *
 * Every target is the size of the drawing buffer. A group's effects run in
 * screen space, so a smaller buffer would have to reason about where the
 * group's content lands and how far a kernel reaches past it; that is a real
 * optimisation and not the first version of one.
 *
 * The stencil is the part that is easy to get wrong. Clips and even-odd fills
 * live in the stencil buffer, and an FBO does not inherit the default
 * framebuffer's — one without its own attachment renders even-odd paths with
 * their holes filled and clips that do not clip, with no GL error and nothing
 * in a call-sequence test to catch it. Every target here gets a
 * DEPTH24_STENCIL8 renderbuffer of its own.
 */

export interface EffectTarget {
  readonly fbo: WebGLFramebuffer;
  readonly texture: WebGLTexture;
  /** @internal — the pool's own bookkeeping. */
  readonly stencil: WebGLRenderbuffer;
}

export class EffectTargets {
  private readonly gl: WebGL2RenderingContext;
  private readonly all: EffectTarget[] = [];
  private free: EffectTarget[] = [];
  private width = 0;
  private height = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /** True once anything has been allocated — what a test asks instead of
   *  reaching for the private arrays. */
  get allocated(): boolean {
    return this.all.length > 0;
  }

  /**
   * Borrow a target sized `width` × `height` device pixels. A size change
   * drops every pooled buffer rather than resizing in place: a borrowed one
   * cannot be resized under its holder, and a resize is not a per-frame event.
   */
  acquire(width: number, height: number): EffectTarget {
    if (width !== this.width || height !== this.height) {
      this.free = [];
      this.releaseAll();
      this.width = width;
      this.height = height;
    }
    const pooled = this.free.pop();
    if (pooled) return pooled;
    const made = this.create(width, height);
    this.all.push(made);
    return made;
  }

  /** Hand one back. Order does not matter — every target is interchangeable. */
  release(target: EffectTarget): void {
    this.free.push(target);
  }

  /** Drop every buffer. Called on dispose and on context loss, where the
   *  handles are already invalid and only the bookkeeping has to go. */
  releaseAll(): void {
    const gl = this.gl;
    for (const t of this.all) {
      gl.deleteFramebuffer(t.fbo);
      gl.deleteTexture(t.texture);
      gl.deleteRenderbuffer(t.stencil);
    }
    this.all.length = 0;
    this.free = [];
    this.width = 0;
    this.height = 0;
  }

  private create(width: number, height: number): EffectTarget {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // LINEAR so an effect can sample between texels; CLAMP_TO_EDGE so a kernel
    // reaching past the edge repeats the border instead of wrapping the
    // opposite side of the screen into frame.
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

    return { fbo, texture, stencil };
  }
}
