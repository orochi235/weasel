/** Render targets on a WebGL2 context: framebuffers, the resolve out of a
 *  multisampled one, and reading ids back. */
import type { GpuFilter, GpuRect, GpuTarget, GpuTargetDesc } from '../types';
import type { GlCache } from './glCache';
import { createTexture, deleteTexture, type GlTexture } from './glResources';

export interface GlTarget extends GpuTarget {
  readonly fbo: WebGLFramebuffer;
  readonly color: GlTexture | null;
  readonly ids: GlTexture | null;
  /** The color of a multisampled target, and the stencil of any. */
  readonly renderbuffers: readonly WebGLRenderbuffer[];
  /** A single-sampled copy a multisampled target resolves through: a blit out
   *  of one may not move what it copies. Made the first time one is needed. */
  resolved: { fbo: WebGLFramebuffer; color: WebGLRenderbuffer } | null;
}

function emptyTexture(gl: WebGL2RenderingContext, cache: GlCache, width: number, height: number, filter: GpuFilter): GlTexture {
  // Clamped, so a kernel reaching past the edge repeats the border instead of
  // wrapping the opposite side of the buffer into frame.
  return createTexture(gl, cache, 'rgba8', { min: filter, mag: filter, wrapS: 'clamp', wrapT: 'clamp' },
    { width, height, data: null });
}

function renderbuffer(gl: WebGL2RenderingContext, format: number, samples: number, width: number, height: number): WebGLRenderbuffer {
  const rb = gl.createRenderbuffer()!;
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  if (samples > 0) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, format, width, height);
  else gl.renderbufferStorage(gl.RENDERBUFFER, format, width, height);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  return rb;
}

/**
 * An FBO does not inherit the default framebuffer's stencil: one without its
 * own renders even-odd paths with their holes filled and clips that do not
 * clip, with no GL error. So a target asked for one gets a DEPTH24_STENCIL8
 * attachment.
 */
export function createTarget(gl: WebGL2RenderingContext, cache: GlCache, desc: GpuTargetDesc): GlTarget {
  const { width, height } = desc;
  const samples = desc.samples ?? 0;
  const color = samples > 0 ? null : emptyTexture(gl, cache, width, height, desc.filter ?? 'nearest');
  // Ids are not samples to blend between.
  const ids = desc.ids ? emptyTexture(gl, cache, width, height, 'nearest') : null;
  const renderbuffers: WebGLRenderbuffer[] = [];
  const colorRb = samples > 0 ? renderbuffer(gl, gl.RGBA8, samples, width, height) : null;
  if (colorRb) renderbuffers.push(colorRb);
  const stencil = desc.stencil ? renderbuffer(gl, gl.DEPTH24_STENCIL8, samples, width, height) : null;
  if (stencil) renderbuffers.push(stencil);

  const fbo = gl.createFramebuffer()!;
  cache.bindFramebuffer(fbo);
  if (color) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color.handle, 0);
  else gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, colorRb);
  if (stencil) gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencil);
  if (ids) {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, ids.handle, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    cache.madeDrawBuffers(fbo, 'both');
  }
  cache.bindFramebuffer(null);
  const perPixel = Math.max(1, samples) * (4 + (stencil ? 4 : 0)) + (ids ? 4 : 0);
  return {
    kind: 'target', width, height, samples, fbo, color, ids, renderbuffers, resolved: null,
    get bytes() { return width * height * (perPixel + (this.resolved ? 4 : 0)); },
  };
}

export function deleteTarget(gl: WebGL2RenderingContext, cache: GlCache, target: GlTarget): void {
  if (cache.framebuffer === target.fbo) cache.framebuffer = undefined;
  gl.deleteFramebuffer(target.fbo);
  if (target.color) deleteTexture(gl, cache, target.color);
  if (target.ids) deleteTexture(gl, cache, target.ids);
  for (const rb of target.renderbuffers) gl.deleteRenderbuffer(rb);
  if (target.resolved) {
    gl.deleteFramebuffer(target.resolved.fbo);
    gl.deleteRenderbuffer(target.resolved.color);
  }
}

function resolvedOf(gl: WebGL2RenderingContext, target: GlTarget): WebGLFramebuffer {
  if (target.resolved) return target.resolved.fbo;
  const color = renderbuffer(gl, gl.RGBA8, 0, target.width, target.height);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
  gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
  target.resolved = { fbo, color };
  return fbo;
}

/** Copy the bottom-left `width × height` of `source` into `dest` at `x, y`
 *  from its bottom-left. */
export function resolve(
  gl: WebGL2RenderingContext, cache: GlCache, source: GlTarget, dest: GlTarget,
  width: number, height: number, x: number, y: number,
): void {
  const scissor = cache.scissorRect();
  cache.setScissor(null);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source.fbo);
  // ANGLE's Metal backend resolves more of a multisampled buffer than the
  // rect asked for, over a neighboring tile: only a whole-buffer resolve
  // lands straight in the surface.
  if (source.samples > 0 && (x !== 0 || y !== 0 || width !== source.width || height !== source.height)) {
    const via = resolvedOf(gl, source);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, via);
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, via);
  }
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dest.fbo);
  gl.blitFramebuffer(0, 0, width, height, x, y, x + width, y + height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  // Both bindings changed under the cache's single one.
  cache.framebuffer = undefined;
  if (scissor) cache.setScissor(scissor);
}

export function readIds(gl: WebGL2RenderingContext, cache: GlCache, target: GlTarget, rect: GpuRect): Uint8Array {
  const bytes = new Uint8Array(rect.width * rect.height * 4);
  cache.bindFramebuffer(target.fbo);
  gl.readBuffer(gl.COLOR_ATTACHMENT1);
  gl.readPixels(rect.x, rect.y, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  gl.readBuffer(gl.COLOR_ATTACHMENT0);
  return bytes;
}
