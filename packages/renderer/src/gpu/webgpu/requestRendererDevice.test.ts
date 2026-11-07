import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('requestRendererDevice', () => {
  it("asks for the adapter's largest texture, as a WebGL context offers it, not WebGPU's default 8192", async () => {
    const requestDevice = vi.fn(async () => ({ lost: new Promise(() => {}) }));
    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: async () => ({ limits: { maxTextureDimension2D: 16384 }, requestDevice }) },
    });
    const { requestRendererDevice } = await import('./requestRendererDevice');
    await requestRendererDevice();
    expect(requestDevice).toHaveBeenCalledWith({ requiredLimits: { maxTextureDimension2D: 16384 } });
  });
});
