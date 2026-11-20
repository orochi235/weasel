/**
 * A stand-in `GPUDevice` for jsdom tests of the WebGPU layer: every object it
 * hands out records what was called on it, and nothing draws. Tests read
 * which buffers and textures were destroyed, what each encoder encoded, and
 * steer the promises a real device settles (`lose`, `failMaps`, `failPipelines`).
 */

import { NOT_METHODS } from './standInKeys';

export interface FakeGpuObject {
  readonly label: string;
  readonly desc: Record<string, unknown>;
  destroyed: boolean;
}

export interface FakeGpuDevice {
  readonly device: GPUDevice;
  readonly context: GPUCanvasContext;
  readonly canvas: { width: number; height: number };
  readonly buffers: FakeGpuObject[];
  readonly textures: FakeGpuObject[];
  /** Each render pass encoder's calls, in order, as `[method, ...args]`. */
  readonly passCalls: unknown[][];
  /** Settle `device.lost`. */
  lose(reason?: string): void;
  /** Reject every later `mapAsync`, as a lost or destroyed device does. */
  failMaps: boolean;
  /** Report a validation error for every later pipeline made. */
  failPipelines: boolean;
}

export function fakeGpuDevice(width = 64, height = 64): FakeGpuDevice {
  const buffers: FakeGpuObject[] = [];
  const textures: FakeGpuObject[] = [];
  const passCalls: unknown[][] = [];
  let lose!: (info: GPUDeviceLostInfo) => void;
  const lost = new Promise<GPUDeviceLostInfo>((resolve) => { lose = resolve; });
  const scopes: (unknown | null)[] = [];
  const state = { failMaps: false, failPipelines: false };

  const buffer = (desc: GPUBufferDescriptor) => {
    const record: FakeGpuObject = { label: desc.label ?? 'buffer', desc: { ...desc }, destroyed: false };
    buffers.push(record);
    const bytes = new ArrayBuffer(desc.size);
    return {
      size: desc.size, usage: desc.usage,
      destroy: () => { record.destroyed = true; },
      mapAsync: () => (state.failMaps ? Promise.reject(new DOMException('lost', 'OperationError')) : Promise.resolve()),
      getMappedRange: () => bytes,
      unmap: () => {},
    } as unknown as GPUBuffer;
  };

  const texture = (desc: GPUTextureDescriptor) => {
    const record: FakeGpuObject = { label: desc.label ?? 'texture', desc: { ...desc }, destroyed: false };
    textures.push(record);
    const size = desc.size as number[];
    return {
      width: size[0], height: size[1] ?? 1, format: desc.format,
      createView: () => ({ texture: record }),
      destroy: () => { record.destroyed = true; },
    } as unknown as GPUTexture;
  };

  const renderPass = () => new Proxy({}, {
    get: (_, method: string | symbol) => (typeof method !== 'string' || NOT_METHODS.has(method)
      ? undefined
      : (...args: unknown[]) => { passCalls.push([method, ...args]); }),
  }) as GPURenderPassEncoder;

  const device = {
    limits: { maxTextureDimension2D: 8192, minUniformBufferOffsetAlignment: 256 },
    lost,
    queue: { writeBuffer() {}, writeTexture() {}, copyExternalImageToTexture() {}, submit: () => { present(); } },
    createBuffer: buffer,
    createTexture: texture,
    createSampler: () => ({}),
    createBindGroupLayout: () => ({}),
    createBindGroup: () => ({}),
    createPipelineLayout: () => ({}),
    createShaderModule: () => ({ getCompilationInfo: () => Promise.resolve({ messages: [] }) }),
    createRenderPipeline: () => {
      if (state.failPipelines && scopes.length > 0) scopes[scopes.length - 1] ??= { message: 'invalid pipeline' };
      return { getBindGroupLayout: () => ({}) };
    },
    pushErrorScope: () => { scopes.push(null); },
    popErrorScope: () => Promise.resolve(scopes.pop() ?? null),
    createCommandEncoder: () => ({
      beginRenderPass: renderPass,
      copyTextureToBuffer() {}, copyTextureToTexture() {},
      finish: () => ({}),
    }),
  } as unknown as GPUDevice;

  // A real context's texture lasts one frame, sized to the canvas when it was
  // taken; a submit stands in for the frame's end.
  let current: { texture: GPUTexture; record: FakeGpuObject } | null = null;
  const present = (): void => {
    if (current) current.record.destroyed = true;
    current = null;
  };
  const canvas = { width, height };
  const context = {
    configure() {},
    getCurrentTexture: () => {
      if (current && (current.texture.width !== canvas.width || current.texture.height !== canvas.height)) present();
      if (!current) {
        const tex = texture({ label: 'context', size: [canvas.width, canvas.height], format: 'rgba8unorm', usage: 0 });
        current = { texture: tex, record: textures[textures.length - 1] };
      }
      return current.texture;
    },
  } as unknown as GPUCanvasContext;

  return {
    device, context, canvas, buffers, textures, passCalls,
    lose: (reason = 'unknown') => lose({ reason, message: 'lost' } as GPUDeviceLostInfo),
    get failMaps() { return state.failMaps; },
    set failMaps(v) { state.failMaps = v; },
    get failPipelines() { return state.failPipelines; },
    set failPipelines(v) { state.failPipelines = v; },
  };
}
