import { describe, expect, it } from 'vitest';
import { fakeGpuDevice } from './fakeGpuDevice';

describe('fakeGpuDevice', () => {
  it('hands out a render pass that is not a thenable', async () => {
    const fake = fakeGpuDevice();
    const pass = fake.device.createCommandEncoder().beginRenderPass({ colorAttachments: [] });
    await expect(Promise.resolve(pass)).resolves.toBe(pass);
    expect(fake.passCalls).toEqual([]);
  });

  it('hands out a canvas texture per frame, sized to the canvas when taken', () => {
    const fake = fakeGpuDevice(64, 64);
    const first = fake.context.getCurrentTexture();
    expect(fake.context.getCurrentTexture()).toBe(first);
    fake.device.queue.submit([]);
    const second = fake.context.getCurrentTexture();
    expect(second).not.toBe(first);
    expect(fake.textures[0].destroyed).toBe(true);
    fake.canvas.width = 128;
    const resized = fake.context.getCurrentTexture();
    expect([resized.width, resized.height]).toEqual([128, 64]);
  });
});
