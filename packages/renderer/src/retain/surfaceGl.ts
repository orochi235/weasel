/** The GL objects behind retained surfaces: allocating them, and copying a
 *  drawn surface out of the multisampled buffer it was drawn in. */

/** A texture with a framebuffer that writes it. */
export interface SurfaceTexture {
  texture: WebGLTexture;
  /** Reads nothing; the resolve blit's destination. */
  fbo: WebGLFramebuffer;
}

/** The multisampled buffer every retained group is drawn in, a tile at a
 *  time, before each tile is resolved into the group's texture, so its edges
 *  match what drawing it on the canvas would have produced. Its bottom-left
 *  corner is what a tile is resolved from. */
export interface Scratch {
  fbo: WebGLFramebuffer;
  color: WebGLRenderbuffer;
  stencil: WebGLRenderbuffer;
  width: number;
  height: number;
  samples: number;
  /** A single-sampled copy of a multisampled scratch buffer, which a tile
   *  smaller than the buffer, or bound anywhere but the surface's corner,
   *  resolves through: a blit out of a multisampled buffer may not move what
   *  it copies. Made the first time one is needed. */
  resolved: { fbo: WebGLFramebuffer; color: WebGLRenderbuffer } | null;
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
  return { fbo, color, stencil, width, height, samples, resolved: null };
}

export function deleteScratch(gl: WebGL2RenderingContext, scratch: Scratch): void {
  gl.deleteFramebuffer(scratch.fbo);
  gl.deleteRenderbuffer(scratch.color);
  gl.deleteRenderbuffer(scratch.stencil);
  if (scratch.resolved) {
    gl.deleteFramebuffer(scratch.resolved.fbo);
    gl.deleteRenderbuffer(scratch.resolved.color);
  }
}

/** Copy the bottom-left `width × height` of `scratch` into `target` at `x, y`
 *  from its bottom-left, leaving the framebuffers and scissor test as it found
 *  them. */
export function resolveInto(
  gl: WebGL2RenderingContext, scratch: Scratch, target: SurfaceTexture, width: number, height: number,
  x = 0, y = 0,
): void {
  const scissor = gl.isEnabled(gl.SCISSOR_TEST);
  const read = (gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null) ?? null;
  const draw = (gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null) ?? null;
  gl.disable(gl.SCISSOR_TEST);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, scratch.fbo);
  // ANGLE's Metal backend resolves more of a multisampled buffer than the
  // rect asked for, over a neighboring tile: only a whole-buffer resolve
  // lands straight in the surface.
  if (scratch.samples > 0 && (x !== 0 || y !== 0 || width !== scratch.width || height !== scratch.height)) {
    const via = resolvedOf(gl, scratch);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, via);
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, via);
  }
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target.fbo);
  gl.blitFramebuffer(0, 0, width, height, x, y, x + width, y + height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, draw);
  if (scissor) gl.enable(gl.SCISSOR_TEST);
}

function resolvedOf(gl: WebGL2RenderingContext, scratch: Scratch): WebGLFramebuffer {
  if (scratch.resolved) return scratch.resolved.fbo;
  const color = gl.createRenderbuffer()!;
  gl.bindRenderbuffer(gl.RENDERBUFFER, color);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, scratch.width, scratch.height);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  const fbo = gl.createFramebuffer()!;
  const draw = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
  gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, draw);
  scratch.resolved = { fbo, color };
  return fbo;
}
