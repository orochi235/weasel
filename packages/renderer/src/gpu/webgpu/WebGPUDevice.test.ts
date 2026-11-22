import { describe, expect, it, vi } from 'vitest';
import type { GpuGeometry, GpuProgram } from '../types';
import { WebGPUDevice } from './WebGPUDevice';
import type { WgpuProgram } from './wgpuProgram';
import type { WgpuTarget } from './wgpuTargets';
import { KIT_WGSL } from './wgsl/kitPrograms';
import { WeaselRenderer } from '../../WeaselRenderer';
import { fakeGpuDevice } from '../../testing/fakeGpuDevice';

function renderer(fake = fakeGpuDevice()) {
  const r = new WeaselRenderer({
    gpu: { device: fake.device, canvas: fake.canvas as unknown as HTMLCanvasElement, context: fake.context },
    width: 64, height: 64, dpr: 1,
  });
  return { fake, r };
}

describe('a WebGPU renderer', () => {
  it('destroys every buffer and texture it made when disposed', () => {
    const { fake, r } = renderer();
    r.render([{ kind: 'rect', x: 0, y: 0, width: 10, height: 10, fill: { kind: 'solid', color: [1, 0, 0, 1] } } as never]);
    r.dispose();
    const kept = [...fake.buffers, ...fake.textures].filter((o) => !o.destroyed && o.label !== 'context');
    expect(kept.map((o) => o.label)).toEqual([]);
  });
});

describe('a WebGPU device drawing with a program the GPU refuses', () => {
  function drawOnce(gpu: WebGPUDevice, program: GpuProgram, geometry: GpuGeometry) {
    gpu.beginPass({ target: null, viewport: { x: 0, y: 0, width: 64, height: 64 } });
    gpu.draw({ program, blend: null, colorWrite: true, stencil: null, ids: false }, geometry, 3);
    gpu.endPass();
  }

  it('stops drawing with it once the refusal arrives, which would void every command beside it', async () => {
    const fake = fakeGpuDevice();
    const gpu = new WebGPUDevice(fake.device, fake.canvas as unknown as HTMLCanvasElement, fake.context, 'rgba8unorm', true);
    const program = gpu.createProgram({ wgsl: KIT_WGSL.pathFill.code });
    const vertices = gpu.createBuffer('vertex', new Float32Array(6), 'static');
    const geometry = gpu.createGeometry({
      vertexBuffers: [{ buffer: vertices, stride: 8, attributes: [{ location: 0, components: 2, offset: 0 }] }],
      indexBuffer: gpu.createBuffer('index', new Uint32Array([0, 1, 2]), 'static'), indexFormat: 'uint32',
    });
    fake.failPipelines = true;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    drawOnce(gpu, program, geometry);
    await new Promise((r) => setTimeout(r, 0));
    fake.passCalls.length = 0;
    drawOnce(gpu, program, geometry);
    expect(fake.passCalls.filter(([m]) => m === 'drawIndexed' || m === 'setPipeline')).toEqual([]);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});

describe('a WebGPU device reading back across a device loss', () => {
  it('answers no ids, as a lost WebGL context does, rather than rejecting, and frees the readback buffer', async () => {
    const fake = fakeGpuDevice();
    const gpu = new WebGPUDevice(fake.device, fake.canvas as unknown as HTMLCanvasElement, fake.context, 'rgba8unorm', true);
    const target = gpu.createTarget({ width: 8, height: 8, ids: true });
    fake.failMaps = true;
    const before = fake.buffers.length;
    await expect(gpu.readIds(target, { x: 0, y: 0, width: 2, height: 2 })).resolves.toEqual(new Uint8Array(16));
    await expect(gpu.readCanvas({ x: 0, y: 0, width: 2, height: 2 })).resolves.toEqual(new Uint8Array(16));
    expect(fake.buffers.slice(before).filter((b) => !b.destroyed)).toEqual([]);
  });
});

describe('a WGSL program written by array slot', () => {
  it('takes a write to one slot by its GLSL name, as a GL program does', () => {
    const fake = fakeGpuDevice();
    const gpu = new WebGPUDevice(fake.device, fake.canvas as unknown as HTMLCanvasElement, fake.context, 'rgba8unorm', true);
    const program = gpu.createProgram({ wgsl: [
      'struct U { u_ripples: array<vec4f, 3> }',
      '@group(1) @binding(0) var<uniform> u: U;',
      '@vertex fn vs(@location(0) a_position: vec2f) -> @builtin(position) vec4f { return vec4f(a_position, 0.0, 1.0); }',
      '@fragment fn fs() -> @location(0) vec4f { return u.u_ripples[2]; }',
    ].join('\n') }) as WgpuProgram;
    expect(program.has('u_ripples[2]')).toBe(true);
    program.set('u_ripples[2]', 'vec4', [1, 2, 3, 4]);
    const mirror = new Uint8Array(program.uploadBytes(0, 256));
    program.upload(mirror, 0, 0, 256);
    expect(Array.from(new Float32Array(mirror.buffer, 32, 4))).toEqual([1, 2, 3, 4]);
  });
});

describe('a WGSL program whose own struct shares a member name with the kit block', () => {
  it('writes the kit name to the kit block and the bare name to its own', () => {
    const fake = fakeGpuDevice();
    const gpu = new WebGPUDevice(fake.device, fake.canvas as unknown as HTMLCanvasElement, fake.context, 'rgba8unorm', true);
    const program = gpu.createProgram({ wgsl: [
      'struct Kit { bounds: vec4f }',
      '@group(0) @binding(0) var<uniform> kit: Kit;',
      'struct Params { bounds: vec4f }',
      '@group(1) @binding(0) var<uniform> params: Params;',
      '@vertex fn vs(@location(0) a_position: vec2f) -> @builtin(position) vec4f { return vec4f(a_position, 0.0, 1.0); }',
      '@fragment fn fs() -> @location(0) vec4f { return kit.bounds + params.bounds; }',
    ].join('\n') }) as WgpuProgram;
    program.set4f('u_bounds', 1, 2, 3, 4);
    program.set4f('bounds', 5, 6, 7, 8);
    const mirror = new Uint8Array(program.uploadBytes(0, 256));
    program.upload(mirror, 0, 0, 256);
    expect(Array.from(new Float32Array(mirror.buffer, 0, 4))).toEqual([1, 2, 3, 4]);
    expect(Array.from(new Float32Array(mirror.buffer, 256, 4))).toEqual([5, 6, 7, 8]);
  });
});

describe('a WebGPU buffer written off a 4-byte boundary', () => {
  function device() {
    const fake = fakeGpuDevice();
    return new WebGPUDevice(fake.device, fake.canvas as unknown as HTMLCanvasElement, fake.context, 'rgba8unorm', true);
  }

  it('refuses a write that would zero the bytes after it, or that starts between words', () => {
    const gpu = device();
    const indices = gpu.createBuffer('index', new Uint16Array(8), 'dynamic');
    expect(() => gpu.writeBuffer(indices, 0, new Uint16Array([1, 2, 3]))).toThrow(/multiple of 4/);
    expect(() => gpu.writeBuffer(indices, 2, new Uint16Array([1, 2]))).toThrow(/multiple of 4/);
  });

  it('takes one ending on the buffer\'s end, whose padding falls past it', () => {
    const gpu = device();
    const indices = gpu.createBuffer('index', new Uint16Array(3), 'dynamic');
    expect(() => gpu.writeBuffer(indices, 0, new Uint16Array([1, 2, 3]))).not.toThrow();
  });
});

describe('a WebGPU target asked for a sample count the device does not make', () => {
  it('reports the samples it made and the bytes they take', () => {
    const fake = fakeGpuDevice();
    const gpu = new WebGPUDevice(fake.device, fake.canvas as unknown as HTMLCanvasElement, fake.context, 'rgba8unorm', true);
    const eight = gpu.createTarget({ width: 4, height: 4, samples: 8, stencil: true });
    expect([eight.samples, eight.bytes]).toEqual([4, 16 * 4 * 8]);
    const one = gpu.createTarget({ width: 4, height: 4, samples: 1 });
    expect([one.samples, one.bytes, one.color !== null]).toEqual([0, 16 * 4, true]);
  });

  it('refuses a multisampled target with ids, whose attachments could not share a pass', () => {
    const fake = fakeGpuDevice();
    const gpu = new WebGPUDevice(fake.device, fake.canvas as unknown as HTMLCanvasElement, fake.context, 'rgba8unorm', true);
    expect(() => gpu.createTarget({ width: 4, height: 4, samples: 4, ids: true })).toThrow('multisampled target cannot have ids');
  });
});

describe('a WebGPU target whose color texture is replaced', () => {
  it('draws into the texture its color now holds', () => {
    const fake = fakeGpuDevice();
    const gpu = new WebGPUDevice(fake.device, fake.canvas as unknown as HTMLCanvasElement, fake.context, 'rgba8unorm', true);
    const target = gpu.createTarget({ width: 4, height: 4 }) as WgpuTarget;
    gpu.writeTexture(target.color!, { width: 4, height: 4, data: null });
    gpu.generateMipmaps(target.color!);
    expect(target.colorView()).toBe(target.color!.view);
  });
});

describe('WebGPU renderers built and freed on one shared device', () => {
  /** `fake`, with each reaction registered on its `device.lost` counted. A reaction on a promise that
   *  never settles holds what it closes over for as long as the device lives. */
  function countingLoss() {
    const fake = fakeGpuDevice();
    const real = fake.device.lost;
    const counted = { reactions: 0 };
    Object.defineProperty(fake.device, 'lost', {
      value: { then: (ok?: () => unknown, no?: () => unknown) => { counted.reactions++; return real.then(ok, no); } },
    });
    return { fake, counted };
  }

  it('leave nothing of a freed renderer waiting on the device', () => {
    const { fake, counted } = countingLoss();
    renderer(fake).r.dispose();
    const afterOne = counted.reactions;
    for (let i = 0; i < 5; i++) renderer(fake).r.dispose();
    expect(counted.reactions).toBe(afterOne);
  });

  it('still hear the device go, and log it once', async () => {
    const { fake } = countingLoss();
    const a = renderer(fake).r;
    const b = renderer(fake).r;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    fake.lose();
    await new Promise((r) => setTimeout(r, 0));
    expect([a.isContextLost(), b.isContextLost()]).toEqual([true, true]);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});

describe('a WebGPU canvas with no area', () => {
  it('keeps the buffers it made for it from pass to pass rather than making new ones each time', () => {
    const fake = fakeGpuDevice(0, 0);
    const gpu = new WebGPUDevice(fake.device, fake.canvas as unknown as HTMLCanvasElement, fake.context, 'rgba8unorm', true);
    const before = fake.textures.length;
    for (let i = 0; i < 3; i++) {
      gpu.beginPass({ target: null, viewport: { x: 0, y: 0, width: 0, height: 0 } });
      gpu.endPass();
    }
    const made = fake.textures.slice(before).filter((t) => t.label.startsWith('canvas'));
    expect(made.map((t) => t.label).sort()).toEqual(['canvas color', 'canvas resolved', 'canvas stencil']);
  });
});

describe('a WebGPU canvas read back after a resize and before the next frame', () => {
  function copies(fake: ReturnType<typeof fakeGpuDevice>) {
    const calls: unknown[][] = [];
    const make = fake.device.createCommandEncoder.bind(fake.device);
    fake.device.createCommandEncoder = ((desc?: GPUCommandEncoderDescriptor) => {
      const encoder = make(desc);
      encoder.copyTextureToBuffer = (...args: unknown[]) => { calls.push(args); };
      return encoder;
    }) as GPUDevice['createCommandEncoder'];
    return calls;
  }

  it('reads the bottom rows of what the last frame drew, counted from that frame\'s height', () => {
    const fake = fakeGpuDevice(64, 64);
    const gpu = new WebGPUDevice(fake.device, fake.canvas as unknown as HTMLCanvasElement, fake.context, 'rgba8unorm', true);
    gpu.beginPass({ target: null, viewport: { x: 0, y: 0, width: 64, height: 64 } });
    gpu.endPass();
    const calls = copies(fake);
    fake.canvas.height = 32;
    void gpu.readCanvas({ x: 0, y: 0, width: 2, height: 2 });
    expect((calls[0][0] as GPUTexelCopyTextureInfo).origin).toEqual([0, 62]);
  });

  it('copies only the part of the rect the smaller frame holds', () => {
    const fake = fakeGpuDevice(64, 64);
    const gpu = new WebGPUDevice(fake.device, fake.canvas as unknown as HTMLCanvasElement, fake.context, 'rgba8unorm', true);
    gpu.beginPass({ target: null, viewport: { x: 0, y: 0, width: 64, height: 64 } });
    gpu.endPass();
    const calls = copies(fake);
    fake.canvas.width = fake.canvas.height = 128;
    void gpu.readCanvas({ x: 60, y: 60, width: 8, height: 8 });
    expect(calls[0][2]).toEqual([4, 4]);
  });
});
