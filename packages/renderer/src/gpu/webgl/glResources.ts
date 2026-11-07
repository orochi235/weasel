/** Buffers, geometry and textures on a WebGL2 context. */
import type {
  GpuBuffer, GpuBufferUsage, GpuGeometry, GpuGeometryDesc, GpuIndexFormat, GpuSampling, GpuTexture,
  GpuTextureData, GpuTextureFormat,
} from '../types';
import type { GlCache } from './glCache';

export interface GlBuffer extends GpuBuffer {
  readonly handle: WebGLBuffer;
  /** The geometry this index buffer was last bound into, which holds it as
   *  its element binding: a write binds that, not some other. */
  owner?: GlGeometry;
}

export interface GlGeometry extends GpuGeometry {
  readonly vao: WebGLVertexArrayObject;
  readonly indexBuffer: GlBuffer;
}

export interface GlTexture extends GpuTexture {
  readonly handle: WebGLTexture;
  readonly format: GpuTextureFormat;
  /** The sampling last set, so an unchanged one is not sent again. */
  sampling: GpuSampling;
}

function usageOf(gl: WebGL2RenderingContext, usage: GpuBufferUsage): number {
  return usage === 'static' ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW;
}

/** Bind `buffer` to its own target. An index buffer's binding belongs to a
 *  vertex array, so it goes into the one that owns it, or none. */
function bindBuffer(gl: WebGL2RenderingContext, cache: GlCache, buffer: GlBuffer): number {
  if (buffer.kind === 'vertex') {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.handle);
    return gl.ARRAY_BUFFER;
  }
  const owner = buffer.owner;
  cache.bindVertexArray(owner ? owner.vao : null);
  if (!owner) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer.handle);
  return gl.ELEMENT_ARRAY_BUFFER;
}

export function createBuffer(
  gl: WebGL2RenderingContext, cache: GlCache, kind: GpuBuffer['kind'], init: number | ArrayBufferView,
  usage: GpuBufferUsage,
): GlBuffer {
  const handle = gl.createBuffer();
  if (!handle) throw new Error(`createBuffer (${kind}) returned null`);
  const buffer: GlBuffer = { kind, handle };
  resizeBuffer(gl, cache, buffer, init, usage);
  return buffer;
}

export function resizeBuffer(
  gl: WebGL2RenderingContext, cache: GlCache, buffer: GlBuffer, init: number | ArrayBufferView, usage: GpuBufferUsage,
): void {
  const target = bindBuffer(gl, cache, buffer);
  gl.bufferData(target, init as ArrayBufferView, usageOf(gl, usage));
}

export function writeBuffer(
  gl: WebGL2RenderingContext, cache: GlCache, buffer: GlBuffer, dstByteOffset: number, data: ArrayBufferView,
  srcOffset?: number, length?: number,
): void {
  const target = bindBuffer(gl, cache, buffer);
  if (srcOffset === undefined && length === undefined) gl.bufferSubData(target, dstByteOffset, data);
  else gl.bufferSubData(target, dstByteOffset, data, srcOffset ?? 0, length);
}

export function createGeometry(gl: WebGL2RenderingContext, cache: GlCache, desc: GpuGeometryDesc): GlGeometry {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('createVertexArray returned null');
  cache.bindVertexArray(vao);
  for (const { buffer, stride, attributes } of desc.vertexBuffers) {
    gl.bindBuffer(gl.ARRAY_BUFFER, (buffer as GlBuffer).handle);
    for (const a of attributes) {
      gl.enableVertexAttribArray(a.location);
      gl.vertexAttribPointer(a.location, a.components, gl.FLOAT, false, stride, a.offset);
    }
  }
  const indexBuffer = desc.indexBuffer as GlBuffer;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer.handle);
  cache.bindVertexArray(null);
  const geometry: GlGeometry = { kind: 'geometry', indexFormat: desc.indexFormat, vao, indexBuffer };
  indexBuffer.owner = geometry;
  return geometry;
}

export function deleteGeometry(gl: WebGL2RenderingContext, cache: GlCache, geometry: GlGeometry): void {
  cache.forgetVertexArray(geometry.vao);
  if (geometry.indexBuffer.owner === geometry) geometry.indexBuffer.owner = undefined;
  gl.deleteVertexArray(geometry.vao);
}

export function indexType(gl: WebGL2RenderingContext, format: GpuIndexFormat): number {
  return format === 'uint16' ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;
}

function filterOf(gl: WebGL2RenderingContext, filter: GpuSampling['min'], mipmap = false): number {
  if (mipmap) return gl.LINEAR_MIPMAP_LINEAR;
  return filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
}

function wrapOf(gl: WebGL2RenderingContext, wrap: GpuSampling['wrapS']): number {
  return wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
}

function upload(gl: WebGL2RenderingContext, format: GpuTextureFormat, data: GpuTextureData): void {
  if ('source' in data) {
    if (data.premultiply) gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data.source);
    // Put back: it would premultiply every later typed-array upload too.
    if (data.premultiply) gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    return;
  }
  const { width, height } = data;
  if (format === 'r8') {
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, data.data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    return;
  }
  const internal = data.data === null ? gl.RGBA8 : gl.RGBA;
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data.data);
}

function applySampling(gl: WebGL2RenderingContext, sampling: Partial<GpuSampling>, was?: GpuSampling): void {
  const mipmap = sampling.mipmap ?? was?.mipmap;
  const min = sampling.min ?? was?.min;
  if (min !== undefined && (!was || min !== was.min || (mipmap ?? false) !== (was.mipmap ?? false))) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterOf(gl, min, mipmap));
  }
  if (sampling.mag !== undefined && sampling.mag !== was?.mag) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterOf(gl, sampling.mag));
  }
  if (sampling.wrapS !== undefined && sampling.wrapS !== was?.wrapS) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapOf(gl, sampling.wrapS));
  }
  if (sampling.wrapT !== undefined && sampling.wrapT !== was?.wrapT) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapOf(gl, sampling.wrapT));
  }
}

export function createTexture(
  gl: WebGL2RenderingContext, cache: GlCache, format: GpuTextureFormat, sampling: GpuSampling, data: GpuTextureData,
): GlTexture {
  const handle = gl.createTexture();
  if (!handle) throw new Error('createTexture returned null');
  const texture: GlTexture = { kind: 'texture', handle, format, sampling };
  cache.withTexture(handle, () => {
    upload(gl, format, data);
    applySampling(gl, sampling);
  });
  return texture;
}

export function writeTexture(gl: WebGL2RenderingContext, cache: GlCache, texture: GlTexture, data: GpuTextureData): void {
  cache.withTexture(texture.handle, () => upload(gl, texture.format, data));
}

export function writeSubTexture(
  gl: WebGL2RenderingContext, cache: GlCache, texture: GlTexture,
  x: number, y: number, width: number, height: number, data: ArrayBufferView,
): void {
  cache.withTexture(texture.handle, () => {
    if (texture.format === 'r8') {
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, width, height, gl.RED, gl.UNSIGNED_BYTE, data);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }
  });
}

export function generateMipmaps(gl: WebGL2RenderingContext, cache: GlCache, texture: GlTexture): void {
  cache.withTexture(texture.handle, () => gl.generateMipmap(gl.TEXTURE_2D));
}

export function setSampling(
  gl: WebGL2RenderingContext, cache: GlCache, texture: GlTexture, sampling: Partial<GpuSampling>,
): void {
  const was = texture.sampling;
  const next = { ...was, ...sampling };
  if (next.min === was.min && next.mag === was.mag && (next.mipmap ?? false) === (was.mipmap ?? false)
      && next.wrapS === was.wrapS && next.wrapT === was.wrapT) return;
  cache.withTexture(texture.handle, () => applySampling(gl, sampling, was));
  texture.sampling = next;
}

export function deleteTexture(gl: WebGL2RenderingContext, cache: GlCache, texture: GlTexture): void {
  cache.forgetTexture(texture.handle);
  gl.deleteTexture(texture.handle);
}
