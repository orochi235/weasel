import { afterEach, describe, expect, it, vi } from 'vitest';

// Stand-ins for the context prototypes the watch wraps, which jsdom does not have.
class FakeGl {
  constructor(readonly canvas: HTMLCanvasElement) {}
  enable(_cap: number): void {}
}
class FakeGpuContext {
  constructor(readonly canvas: HTMLCanvasElement) {}
  configure(_config: { device: object }): void {}
}
class FakeGpuDevice {
  createRenderPipeline(_descriptor: unknown): void {}
}
Object.assign(globalThis, {
  WebGLRenderingContext: FakeGl,
  GPUCanvasContext: FakeGpuContext,
  GPUDevice: FakeGpuDevice,
});
const { install3dWatch, watch3d } = await import('./watch3d');
install3dWatch();

const DEPTH_TEST = 0x0b71;
const DEPTH = { depthStencil: { format: 'depth24plus', depthCompare: 'less' } };

function trialHost(id: string): HTMLElement {
  const host = document.createElement('div');
  host.setAttribute('data-trial-id', id);
  document.body.append(host);
  return host;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('watch3d, for a canvas that joins its trial late', () => {
  it('reports WebGL depth testing turned on again once the canvas is in the trial', () => {
    vi.useFakeTimers();
    const found = vi.fn();
    watch3d('gl', found);
    const canvas = document.createElement('canvas');
    const gl = new FakeGl(canvas);
    gl.enable(DEPTH_TEST);
    vi.advanceTimersByTime(5000);
    trialHost('gl').append(canvas);
    gl.enable(DEPTH_TEST);
    vi.runAllTimers();
    expect(found).toHaveBeenCalledOnce();
    expect(found).toHaveBeenCalledWith('WebGL with depth testing');
    gl.enable(DEPTH_TEST);
    vi.runAllTimers();
    expect(found).toHaveBeenCalledOnce();
  });

  it('reports a WebGPU canvas configured again once it is in the trial', () => {
    vi.useFakeTimers();
    const found = vi.fn();
    watch3d('gpu', found);
    const canvas = document.createElement('canvas');
    const context = new FakeGpuContext(canvas);
    const device = new FakeGpuDevice();
    context.configure({ device });
    device.createRenderPipeline(DEPTH);
    vi.advanceTimersByTime(5000);
    trialHost('gpu').append(canvas);
    context.configure({ device });
    vi.runAllTimers();
    expect(found).toHaveBeenCalledWith('WebGPU with depth testing');
  });

  it('reports every canvas a device configured before its first depth-tested pipeline', () => {
    vi.useFakeTimers();
    const found = vi.fn();
    watch3d('two', found);
    const host = trialHost('two');
    const device = new FakeGpuDevice();
    for (let i = 0; i < 2; i++) {
      const canvas = document.createElement('canvas');
      host.append(canvas);
      const context = new FakeGpuContext(canvas);
      context.configure({ device });
      context.configure({ device });
    }
    device.createRenderPipeline(DEPTH);
    vi.runAllTimers();
    expect(found).toHaveBeenCalledTimes(2);
  });
});
