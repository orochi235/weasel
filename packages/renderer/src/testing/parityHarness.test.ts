import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeGpuDevice, type FakeGpuDevice } from './fakeGpuDevice';

const requested: FakeGpuDevice[] = [];
vi.mock('../gpu/webgpu/requestRendererDevice', () => ({
  requestRendererDevice: async () => {
    const fake = fakeGpuDevice();
    requested.push(fake);
    return fake.device;
  },
}));

const { parityDevice, releaseDevice } = await import('./parityHarness');

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
});
