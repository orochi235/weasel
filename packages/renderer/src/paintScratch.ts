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

export interface PaintScratchTarget {
  readonly fbo: WebGLFramebuffer;
  readonly texture: WebGLTexture;
  /** Texture size, at least the region asked for. */
  readonly width: number;
  readonly height: number;
}

const MIN_SIDE = 64;

export class PaintScratch {
  private readonly gl: WebGL2RenderingContext;
  private target: PaintScratchTarget | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /** A buffer at least `width` × `height` device pixels. Its contents are
   *  whatever the last user left; the caller clears the region it uses. */
  acquire(width: number, height: number): PaintScratchTarget {
    const have = this.target;
    if (have && have.width >= width && have.height >= height) return have;
    const w = Math.max(have?.width ?? 0, pow2(width));
    const h = Math.max(have?.height ?? 0, pow2(height));
    this.release();
    this.target = this.create(w, h);
    return this.target;
  }

  /** Drop the buffer. Called on dispose and on context restore, where the
   *  handles are already dead and only the bookkeeping has to go. */
  release(): void {
    if (!this.target) return;
    this.gl.deleteFramebuffer(this.target.fbo);
    this.gl.deleteTexture(this.target.texture);
    this.target = null;
  }

  private create(width: number, height: number): PaintScratchTarget {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // The region is laid on the device-pixel grid, so every fragment reading
    // it lands on a texel center and NEAREST is exact.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, texture, width, height };
  }
}

function pow2(n: number): number {
  let side = MIN_SIDE;
  while (side < n) side *= 2;
  return side;
}
