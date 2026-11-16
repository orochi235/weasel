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

  it('warns when the device request fails, resolves null, and asks again on the next call', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const requestDevice = vi.fn()
      .mockRejectedValueOnce(new Error('limit refused'))
      .mockResolvedValueOnce({ lost: new Promise(() => {}) });
    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: async () => ({ limits: { maxTextureDimension2D: 16384 }, requestDevice }) },
    });
    const { requestRendererDevice } = await import('./requestRendererDevice');
    expect(await requestRendererDevice()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![1]).toEqual(new Error('limit refused'));
    expect(await requestRendererDevice()).not.toBeNull();
    expect(requestDevice).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
