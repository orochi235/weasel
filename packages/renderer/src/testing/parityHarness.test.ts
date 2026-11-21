import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeGpuDevice, type FakeGpuDevice } from './fakeGpuDevice';
import { createGLRecorder } from './glRecorder';

const requested: FakeGpuDevice[] = [];
vi.mock('../gpu/webgpu/requestRendererDevice', () => ({
  requestRendererDevice: async () => {
    const fake = fakeGpuDevice();
    requested.push(fake);
    return fake.device;
  },
}));

const { openBackends, parityDevice, releaseDevice, renderEach } = await import('./parityHarness');

afterEach(() => {
  releaseDevice();
  requested.length = 0;
  vi.restoreAllMocks();
});

describe('parityDevice', () => {
  it('requests one device for concurrent first calls', async () => {
    const [a, b] = await Promise.all([parityDevice(), parityDevice()]);
    expect(a).toBe(b);
    expect(requested).toHaveLength(1);
  });

  it('requests a new device once the one it holds is lost', async () => {
    const first = await parityDevice();
    requested[0].lose('unknown');
    await Promise.resolve();
    await Promise.resolve();
    expect(await parityDevice()).not.toBe(first);
  });

  it('keeps the device a call opened while an earlier, released one was still opening', async () => {
    const released = parityDevice();
    releaseDevice();
    const kept = await parityDevice();
    await released;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await parityDevice()).toBe(kept);
    expect(requested).toHaveLength(2);
  });
});

describe('renderEach', () => {
  it('destroys its readback buffer when mapping it fails', async () => {
    const fake = fakeGpuDevice(4, 4);
    fake.failMaps = true;
    const { gl } = createGLRecorder();
    const b = {
      gl: { render() {} }, gpu: { render() {} }, glContext: gl, device: fake.device, width: 4, height: 4,
      canvas: { getContext: () => fake.context },
    } as unknown as Parameters<typeof renderEach>[0];
    await expect(renderEach(b, [])).rejects.toThrow();
    expect(fake.buffers.filter((o) => !o.destroyed)).toEqual([]);
  });
});

describe('openBackends', () => {
  it('lets go of the WebGL context when building the WebGPU renderer throws', async () => {
    const recorder = createGLRecorder();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => {
      if (kind === 'webgl2') return recorder.gl;
      throw new Error('no webgpu here');
    }) as typeof HTMLCanvasElement.prototype.getContext);
    await expect(openBackends({ width: 4, height: 4, dpr: 1 })).rejects.toThrow();
    expect(recorder.calls.some((c) => c.name === 'getExtension' && c.args[0] === 'WEBGL_lose_context')).toBe(true);
  });
});
