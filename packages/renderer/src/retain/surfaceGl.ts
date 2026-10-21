/** The GL objects behind retained surfaces: allocating them, and copying a
 *  drawn surface out of the multisampled buffer it was drawn in. */

/** A texture with a framebuffer that writes it. */
export interface SurfaceTexture {
  texture: WebGLTexture;
  /** Reads nothing; the resolve blit's destination. */
  fbo: WebGLFramebuffer;
}

/** The multisampled buffer every retained group is drawn in before it is
 *  resolved into its own texture, so its edges match what drawing it on the
 *  canvas would have produced. Its bottom-left corner is what a surface is
 *  resolved from. */
export interface Scratch {
  fbo: WebGLFramebuffer;
  color: WebGLRenderbuffer;
  stencil: WebGLRenderbuffer;
  width: number;
  height: number;
}

export function createSurfaceTexture(gl: WebGL2RenderingContext, width: number, height: number): SurfaceTexture {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
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
  return { texture, fbo };
}

export function deleteSurfaceTexture(gl: WebGL2RenderingContext, surface: SurfaceTexture): void {
  gl.deleteFramebuffer(surface.fbo);
  gl.deleteTexture(surface.texture);
}

/** A scratch buffer `width × height` with `samples` samples a pixel, or a
 *  single-sampled one for 0. */
export function createScratch(gl: WebGL2RenderingContext, width: number, height: number, samples: number): Scratch {
  const storage = (format: number): WebGLRenderbuffer => {
    const rb = gl.createRenderbuffer()!;
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    if (samples > 0) {
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, format, width, height);
    } else {
      gl.renderbufferStorage(gl.RENDERBUFFER, format, width, height);
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
  return { fbo, color, stencil, width, height };
}

export function deleteScratch(gl: WebGL2RenderingContext, scratch: Scratch): void {
  gl.deleteFramebuffer(scratch.fbo);
  gl.deleteRenderbuffer(scratch.color);
  gl.deleteRenderbuffer(scratch.stencil);
}

/** Copy the bottom-left `width × height` of `scratch` into `target`. */
export function resolveInto(
  gl: WebGL2RenderingContext, scratch: Scratch, target: SurfaceTexture, width: number, height: number,
): void {
  const scissor = gl.isEnabled(gl.SCISSOR_TEST);
  gl.disable(gl.SCISSOR_TEST);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, scratch.fbo);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target.fbo);
  gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (scissor) gl.enable(gl.SCISSOR_TEST);
}
