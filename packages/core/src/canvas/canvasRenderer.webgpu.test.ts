/**
 * Leases on WebGPU share the page's one device, which outlives every one of them.
 */
import { describe, it, expect, vi } from 'vitest';
import { fakeGpuDevice } from '@weasel-js/renderer/testing/fakeGpuDevice';

const gpu = vi.hoisted(() => ({ reactions: 0, fake: null as ReturnType<typeof fakeGpuDevice> | null }));

vi.mock('@weasel-js/renderer', async (importOriginal) => {
  const real = await importOriginal<typeof import('@weasel-js/renderer')>();
  return {
    ...real,
    requestRendererDevice: () => Promise.resolve(gpu.fake!.device),
  };
});

import { leaseCanvasRenderer } from './canvasRenderer';

const size = { width: 10, height: 10, dpr: 1 };

describe('WebGPU leases mounted and freed on one device', () => {
  it('leave nothing of a freed lease waiting on the device, and still hear it go', async () => {
    const fake = fakeGpuDevice();
    const real = fake.device.lost;
    Object.defineProperty(fake.device, 'lost', {
      value: { then: (ok?: () => unknown, no?: () => unknown) => { gpu.reactions++; return real.then(ok, no); } },
    });
    gpu.fake = fake;
    HTMLCanvasElement.prototype.getContext = (function (kind: string) {
      return kind === 'webgpu' ? fake.context : null;
    }) as HTMLCanvasElement['getContext'];

    const mount = async () => {
      const lease = leaseCanvasRenderer({ backend: () => 'webgpu' });
      const canvas = document.createElement('canvas');
      if (!lease.bind(canvas, size)) await new Promise((r) => setTimeout(r, 0));
      expect(lease.bind(canvas, size)?.backend).toBe('webgpu');
      return lease;
    };
    (await mount()).release();
    const afterOne = gpu.reactions;
    for (let i = 0; i < 5; i++) (await mount()).release();
    expect(gpu.reactions).toBe(afterOne);

    const live = await mount();
    const restored = vi.fn();
    live.subscribeRestored(restored);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    fake.lose();
    await new Promise((r) => setTimeout(r, 0));
    expect(restored).toHaveBeenCalledTimes(1);
    error.mockRestore();
    live.release();
  });
});
