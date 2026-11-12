import { describe, expect, it, vi } from 'vitest';
import type { GpuGeometry, GpuProgram } from '../types';
import { WebGPUDevice } from './WebGPUDevice';
import type { WgpuProgram } from './wgpuProgram';
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
