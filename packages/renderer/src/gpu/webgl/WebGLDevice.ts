/** The GPU layer over a WebGL2 context. */
import { PREMULTIPLIED } from '../blend';
import type {
  GpuBuffer, GpuBufferUsage, GpuDevice, GpuDrawState, GpuGeometry, GpuGeometryDesc, GpuLimits, GpuPassDesc,
  GpuProgram, GpuProgramOptions, GpuProgramSource, GpuRect, GpuSampling, GpuTarget, GpuTargetDesc, GpuTexture,
  GpuTextureData, GpuTextureFormat,
} from '../types';
import { GlCache } from './glCache';
import { GlProgram, type GlProgramHost } from './GlProgram';
import * as res from './glResources';
import { createTarget, deleteTarget, readIds, resolve, type GlTarget } from './glTargets';

export class WebGLDevice implements GpuDevice, GlProgramHost {
  readonly language = 'glsl' as const;
  readonly cache: GlCache;
  /** The target the open pass draws into; `null` the canvas. */
  private target: GlTarget | null = null;

  readonly limits: GpuLimits;

  constructor(readonly gl: WebGL2RenderingContext) {
    this.cache = new GlCache(gl);
    this.limits = {
      get maxTextureSize(): number | undefined {
        const reported: unknown = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        return typeof reported === 'number' && reported > 0 ? reported : undefined;
      },
      // The default framebuffer's, read while it is bound.
      get samples(): number | undefined {
        const reported: unknown = gl.getParameter(gl.SAMPLES);
        return typeof reported === 'number' ? reported : undefined;
      },
      get stencil(): boolean | undefined {
        // A stub that cannot answer is not a stencil-less context.
        const attrs = typeof gl.getContextAttributes === 'function' ? gl.getContextAttributes() : null;
        return attrs ? attrs.stencil : undefined;
      },
    };
  }

  isContextLost(): boolean {
    return this.gl.isContextLost();
  }

  canvasSize(): { width: number; height: number } {
    return { width: this.gl.drawingBufferWidth, height: this.gl.drawingBufferHeight };
  }

  beginFrame(): void {
    const gl = this.gl;
    this.cache.reset();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    gl.colorMask(true, true, true, true);
    gl.bindVertexArray(null);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this.cache.assume({ blend: PREMULTIPLIED, colorMask: true, vao: null });
  }

  use(program: GlProgram): void {
    this.cache.useProgram(program.handle);
  }

  createProgram(source: GpuProgramSource, options?: GpuProgramOptions): GpuProgram {
    if (!source.glsl) throw new Error('weasel: the WebGL renderer draws a program only from GLSL source');
    return new GlProgram(this, source.glsl.vert, source.glsl.frag, options);
  }

  deleteProgram(program: GpuProgram): void {
    const { handle } = program as GlProgram;
    this.cache.forgetProgram(handle);
    this.gl.deleteProgram(handle);
  }

  createBuffer(kind: GpuBuffer['kind'], init: number | ArrayBufferView, usage: GpuBufferUsage): GpuBuffer {
    return res.createBuffer(this.gl, this.cache, kind, init, usage);
  }

  resizeBuffer(buffer: GpuBuffer, init: number | ArrayBufferView, usage: GpuBufferUsage): void {
    res.resizeBuffer(this.gl, this.cache, buffer as res.GlBuffer, init, usage);
  }

  writeBuffer(buffer: GpuBuffer, dstByteOffset: number, data: ArrayBufferView, srcOffset?: number, length?: number): void {
    res.writeBuffer(this.gl, this.cache, buffer as res.GlBuffer, dstByteOffset, data, srcOffset, length);
  }

  deleteBuffer(buffer: GpuBuffer): void {
    this.gl.deleteBuffer((buffer as res.GlBuffer).handle);
  }

  createGeometry(desc: GpuGeometryDesc): GpuGeometry {
    return res.createGeometry(this.gl, this.cache, desc);
  }

  deleteGeometry(geometry: GpuGeometry): void {
    res.deleteGeometry(this.gl, this.cache, geometry as res.GlGeometry);
  }

  createTexture(format: GpuTextureFormat, sampling: GpuSampling, data: GpuTextureData): GpuTexture {
    return res.createTexture(this.gl, this.cache, format, sampling, data);
  }

  writeTexture(texture: GpuTexture, data: GpuTextureData): void {
    res.writeTexture(this.gl, this.cache, texture as res.GlTexture, data);
  }

  writeSubTexture(texture: GpuTexture, x: number, y: number, width: number, height: number, data: ArrayBufferView): void {
    res.writeSubTexture(this.gl, this.cache, texture as res.GlTexture, x, y, width, height, data);
  }

  generateMipmaps(texture: GpuTexture): void {
    res.generateMipmaps(this.gl, this.cache, texture as res.GlTexture);
  }

  setSampling(texture: GpuTexture, sampling: Partial<GpuSampling>): void {
    res.setSampling(this.gl, this.cache, texture as res.GlTexture, sampling);
  }

  deleteTexture(texture: GpuTexture): void {
    res.deleteTexture(this.gl, this.cache, texture as res.GlTexture);
  }

  createTarget(desc: GpuTargetDesc): GpuTarget {
    return createTarget(this.gl, this.cache, desc);
  }

  deleteTarget(target: GpuTarget): void {
    deleteTarget(this.gl, this.cache, target as GlTarget);
  }

  beginPass(desc: GpuPassDesc): void {
    const gl = this.gl;
    const cache = this.cache;
    const target = desc.target as GlTarget | null;
    this.target = target;
    cache.bindFramebuffer(target ? target.fbo : null);
    if (target?.color) cache.unbindTexture(target.color.handle);
    cache.setViewport(desc.viewport);
    cache.setScissor(desc.scissor ?? null);
    const clear = desc.clear;
    if (!clear || (!clear.color && !clear.stencil)) return;
    let bits = 0;
    if (clear.color) {
      cache.setColorMask(true);
      if (target?.ids) cache.setDrawBuffers(target.fbo, 'both');
      bits |= gl.COLOR_BUFFER_BIT;
    }
    if (clear.stencil) {
      cache.setStencilMask(0xFF);
      bits |= gl.STENCIL_BUFFER_BIT;
    }
    gl.clear(bits);
  }

  endPass(): void {
    this.target = null;
  }

  setViewport(rect: GpuRect): void {
    this.cache.setViewport(rect);
  }

  setScissor(rect: GpuRect | null): void {
    this.cache.setScissor(rect);
  }

  clearStencilBits(mask: number): void {
    this.cache.setStencilMask(mask);
    this.gl.clear(this.gl.STENCIL_BUFFER_BIT);
  }

  draw(state: GpuDrawState, geometry: GpuGeometry, count: number, firstIndex = 0): void {
    const gl = this.gl;
    const cache = this.cache;
    const program = state.program as GlProgram;
    cache.useProgram(program.handle);
    cache.setBlend(state.blend);
    const target = this.target;
    if (target?.ids && (state.colorWrite || state.ids)) {
      cache.setColorMask(true);
      cache.setDrawBuffers(target.fbo, !state.ids ? 'color' : state.colorWrite ? 'both' : 'ids');
    } else {
      cache.setColorMask(state.colorWrite);
    }
    cache.setStencil(state.stencil);
    const geom = geometry as res.GlGeometry;
    cache.bindVertexArray(geom.vao);
    cache.bindTextures(program.textures as readonly (res.GlTexture | null)[]);
    const type = res.indexType(gl, geom.indexFormat);
    gl.drawElements(gl.TRIANGLES, count, type, firstIndex * (geom.indexFormat === 'uint16' ? 2 : 4));
  }

  resolve(source: GpuTarget, dest: GpuTarget, width: number, height: number, x: number, y: number): void {
    resolve(this.gl, this.cache, source as GlTarget, dest as GlTarget, width, height, x, y);
  }

  readIds(target: GpuTarget, rect: GpuRect): Promise<Uint8Array> {
    return Promise.resolve(this.readIdsSync(target, rect));
  }

  readonly readIdsSync = (target: GpuTarget, rect: GpuRect): Uint8Array =>
    readIds(this.gl, this.cache, target as GlTarget, rect);

  readCanvas(rect: GpuRect): Promise<Uint8Array> {
    return Promise.resolve(this.readCanvasSync(rect));
  }

  readonly readCanvasSync = (rect: GpuRect): Uint8Array => {
    const gl = this.gl;
    const bytes = new Uint8Array(rect.width * rect.height * 4);
    this.cache.bindFramebuffer(null);
    gl.readPixels(rect.x, rect.y, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    return bytes;
  };
}

const DEVICES = new WeakMap<WebGL2RenderingContext, WebGLDevice>();

/** The one device over `gl`: renderers sharing a context share what it
 *  believes the context holds. */
export function webglDevice(gl: WebGL2RenderingContext): WebGLDevice {
  let device = DEVICES.get(gl);
  if (!device) {
    device = new WebGLDevice(gl);
    DEVICES.set(gl, device);
  }
  return device;
}
