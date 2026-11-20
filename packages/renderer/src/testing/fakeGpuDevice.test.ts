import { describe, expect, it } from 'vitest';
import { fakeGpuDevice } from './fakeGpuDevice';

describe('fakeGpuDevice', () => {
  it('hands out a render pass that is not a thenable', async () => {
    const fake = fakeGpuDevice();
    const pass = fake.device.createCommandEncoder().beginRenderPass({ colorAttachments: [] });
    await expect(Promise.resolve(pass)).resolves.toBe(pass);
    expect(fake.passCalls).toEqual([]);
  });
});
