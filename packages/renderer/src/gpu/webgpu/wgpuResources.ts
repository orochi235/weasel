/** Buffers, geometry, textures and samplers on a WebGPU device. */
import type {
  GpuBuffer, GpuBufferUsage, GpuGeometry, GpuGeometryDesc, GpuImageSource, GpuSampling, GpuTexture,
  GpuTextureData, GpuTextureFormat,
} from '../types';
import { BufferUsage, TextureUsage } from './flags';

/** Something a command in the open encoder may read, which a write must not
 *  overtake: queue writes land before the encoder's commands run. */
export interface Tracked {
  /** The serial of the last encoder that used it. */
  usedIn: number;
}

/** What resource code needs of the device. */
export interface ResourceHost {
  readonly device: GPUDevice;
  /** Submit the open encoder first if it uses `resource`. */
  beforeWrite(resource: Tracked): void;
  /** Destroy `object` once nothing submitted or pending can still use it. */
  retire(object: { destroy(): void }): void;
}

export interface WgpuBuffer extends GpuBuffer, Tracked {
  gpu: GPUBuffer;
  size: number;
}

export interface WgpuGeometry extends GpuGeometry {
  readonly buffers: readonly WgpuBuffer[];
  readonly indexBuffer: WgpuBuffer;
  readonly layouts: readonly GPUVertexBufferLayout[];
  /** The layouts as a pipeline key. */
  readonly layoutKey: string;
  /** Every location the layouts feed. */
  readonly locations: ReadonlySet<number>;
}

export interface WgpuTexture extends GpuTexture, Tracked {
  readonly id: number;
  readonly format: GpuTextureFormat;
  gpu: GPUTexture;
  view: GPUTextureView;
  width: number;
  height: number;
  mipLevels: number;
  sampling: GpuSampling;
  /** Advanced whenever `gpu` is replaced, so a bind group made over the old one is not reused. */
  version: number;
}

const align4 = (n: number) => Math.ceil(n / 4) * 4;

function bufferUsage(kind: GpuBuffer['kind']): number {
  return (kind === 'vertex' ? BufferUsage.VERTEX : BufferUsage.INDEX) | BufferUsage.COPY_DST;
}

function allocate(host: ResourceHost, kind: GpuBuffer['kind'], bytes: number): GPUBuffer {
  return host.device.createBuffer({ size: Math.max(4, align4(bytes)), usage: bufferUsage(kind) });
}

/** Write `bytes` at `offset`, padded to the 4-byte multiple a queue write takes. */
function writeBytes(host: ResourceHost, buffer: GPUBuffer, offset: number, bytes: Uint8Array): void {
  if (bytes.byteLength === 0) return;
  const data = bytes.byteLength % 4 === 0 ? bytes : padded(bytes);
  host.device.queue.writeBuffer(buffer, offset, data, 0, data.length);
}

function padded(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(align4(bytes.byteLength));
  out.set(bytes);
  return out;
}

function bytesOf(data: ArrayBufferView, srcOffset = 0, length?: number): Uint8Array {
  const per = 'BYTES_PER_ELEMENT' in data ? (data as unknown as { BYTES_PER_ELEMENT: number }).BYTES_PER_ELEMENT : 1;
  const count = length ?? data.byteLength / per - srcOffset;
  return new Uint8Array(data.buffer, data.byteOffset + srcOffset * per, count * per);
}

export function createBuffer(
  host: ResourceHost, kind: GpuBuffer['kind'], init: number | ArrayBufferView, _usage: GpuBufferUsage,
): WgpuBuffer {
  const size = typeof init === 'number' ? init : init.byteLength;
  const buffer: WgpuBuffer = { kind, gpu: allocate(host, kind, size), size, usedIn: -1 };
  if (typeof init !== 'number') writeBytes(host, buffer.gpu, 0, bytesOf(init));
  return buffer;
}

export function resizeBuffer(host: ResourceHost, buffer: WgpuBuffer, init: number | ArrayBufferView): void {
  host.retire(buffer.gpu);
  buffer.size = typeof init === 'number' ? init : init.byteLength;
  buffer.gpu = allocate(host, buffer.kind, buffer.size);
  buffer.usedIn = -1;
  if (typeof init !== 'number') writeBytes(host, buffer.gpu, 0, bytesOf(init));
}

export function writeBuffer(
  host: ResourceHost, buffer: WgpuBuffer, dstByteOffset: number, data: ArrayBufferView, srcOffset?: number, length?: number,
): void {
  host.beforeWrite(buffer);
  writeBytes(host, buffer.gpu, dstByteOffset, bytesOf(data, srcOffset, length));
}

const FORMATS: readonly GPUVertexFormat[] = ['float32', 'float32x2', 'float32x3', 'float32x4'];

export function createGeometry(desc: GpuGeometryDesc): WgpuGeometry {
  const locations = new Set<number>();
  const layouts = desc.vertexBuffers.map(({ stride, attributes }): GPUVertexBufferLayout => {
    for (const a of attributes) locations.add(a.location);
    const packed = attributes.reduce((end, a) => Math.max(end, a.offset + 4 * a.components), 0);
    return {
      arrayStride: stride || packed,
      attributes: attributes.map((a) => ({ shaderLocation: a.location, offset: a.offset, format: FORMATS[a.components - 1] })),
    };
  });
  const layoutKey = layouts.map((l) => `${l.arrayStride}:${[...l.attributes].map((a) => `${a.shaderLocation}@${a.offset}${a.format}`).join(',')}`).join(';');
  return {
    kind: 'geometry', indexFormat: desc.indexFormat,
    buffers: desc.vertexBuffers.map((b) => b.buffer as WgpuBuffer),
    indexBuffer: desc.indexBuffer as WgpuBuffer, layouts, layoutKey, locations,
  };
}

const GPU_FORMATS: Readonly<Record<GpuTextureFormat, GPUTextureFormat>> = { rgba8: 'rgba8unorm', r8: 'r8unorm' };
const BYTES: Readonly<Record<GpuTextureFormat, number>> = { rgba8: 4, r8: 1 };

/** Every texture can be drawn into, for its mipmaps and for a copy of an image. */
export const TEXTURE_USAGE = TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST | TextureUsage.COPY_SRC
  | TextureUsage.RENDER_ATTACHMENT;

let nextTextureId = 1;

function sizeOf(data: GpuTextureData): { width: number; height: number } {
  if (!('source' in data)) return { width: data.width, height: data.height };
  const source = data.source as GpuImageSource & { naturalWidth?: number; naturalHeight?: number };
  return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
}

export function gpuTexture(device: GPUDevice, format: GpuTextureFormat, width: number, height: number, mipLevels = 1): GPUTexture {
  return device.createTexture({
    label: `${format} ${width}x${height}`,
    size: [Math.max(1, width), Math.max(1, height)], format: GPU_FORMATS[format], usage: TEXTURE_USAGE, mipLevelCount: mipLevels,
  });
}

export function createTexture(
  host: ResourceHost, format: GpuTextureFormat, sampling: GpuSampling, data: GpuTextureData,
): WgpuTexture {
  const { width, height } = sizeOf(data);
  const gpu = gpuTexture(host.device, format, width, height);
  const texture: WgpuTexture = {
    kind: 'texture', id: nextTextureId++, format, gpu, view: gpu.createView(), width, height, mipLevels: 1,
    sampling, version: 0, usedIn: -1,
  };
  upload(host, texture, data);
  return texture;
}

/** Point `texture` at a new GPU texture, retiring the old one. */
export function replaceTexture(host: ResourceHost, texture: WgpuTexture, gpu: GPUTexture, width: number, height: number, mipLevels: number): void {
  host.retire(texture.gpu);
  texture.gpu = gpu;
  texture.view = gpu.createView();
  texture.width = width;
  texture.height = height;
  texture.mipLevels = mipLevels;
  texture.version++;
  texture.usedIn = -1;
}

function upload(host: ResourceHost, texture: WgpuTexture, data: GpuTextureData): void {
  const { width, height } = texture;
  if ('source' in data) {
    // GL uploads an ImageBitmap as it holds its texels, whatever the unpack
    // flags say, and a bitmap made with default options holds them premultiplied.
    const premultipliedAlpha = data.premultiply || (typeof ImageBitmap !== 'undefined' && data.source instanceof ImageBitmap);
    host.device.queue.copyExternalImageToTexture(
      { source: data.source as GPUCopyExternalImageSource },
      { texture: texture.gpu, premultipliedAlpha },
      [width, height],
    );
  } else if (data.data) {
    writeRegion(host, texture, 0, 0, width, height, data.data);
  }
}

function writeRegion(host: ResourceHost, texture: WgpuTexture, x: number, y: number, width: number, height: number,
  data: ArrayBufferView): void {
  if (width === 0 || height === 0) return;
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  host.device.queue.writeTexture(
    { texture: texture.gpu, origin: [x, y] }, bytes,
    { bytesPerRow: width * BYTES[texture.format], rowsPerImage: height }, [width, height],
  );
}

export function writeTexture(host: ResourceHost, texture: WgpuTexture, data: GpuTextureData): void {
  const { width, height } = sizeOf(data);
  const resized = width !== texture.width || height !== texture.height;
  // GL's texImage2D of null leaves the texture empty, and a fresh one is.
  const empty = !('source' in data) && data.data === null;
  if (resized || empty) {
    const levels = resized ? 1 : texture.mipLevels;
    replaceTexture(host, texture, gpuTexture(host.device, texture.format, width, height, levels), width, height, levels);
  } else {
    host.beforeWrite(texture);
  }
  if (!empty) upload(host, texture, data);
}

export function writeSubTexture(host: ResourceHost, texture: WgpuTexture, x: number, y: number, width: number,
  height: number, data: ArrayBufferView): void {
  host.beforeWrite(texture);
  writeRegion(host, texture, x, y, width, height, data);
}

/** A sampler for each sampling, made once. Without mipmaps a sampler reads
 *  level 0 alone, and a LOD clamped just above 0 still picks the min filter
 *  where GL would. */
export class Samplers {
  private readonly made = new Map<string, GPUSampler>();

  constructor(private readonly device: GPUDevice) {}

  get(s: GpuSampling): GPUSampler {
    const key = samplingKey(s);
    let sampler = this.made.get(key);
    if (!sampler) {
      const address = (w: GpuSampling['wrapS']): GPUAddressMode => (w === 'repeat' ? 'repeat' : 'clamp-to-edge');
      sampler = this.device.createSampler({
        magFilter: s.mag, minFilter: s.mipmap ? 'linear' : s.min, mipmapFilter: s.mipmap ? 'linear' : 'nearest',
        addressModeU: address(s.wrapS), addressModeV: address(s.wrapT),
        lodMaxClamp: s.mipmap ? 32 : 0.25,
      });
      this.made.set(key, sampler);
    }
    return sampler;
  }
}

export function samplingKey(s: GpuSampling): string {
  return `${s.min}${s.mag}${s.mipmap ? 'm' : ''}${s.wrapS}${s.wrapT}`;
}
