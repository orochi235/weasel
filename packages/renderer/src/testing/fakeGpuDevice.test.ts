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

  it('rejects a pop with no scope open, as a real device does', async () => {
    const { device } = fakeGpuDevice();
    await expect(device.popErrorScope()).rejects.toThrow(/no error scope/);
  });

  it('raises a pipeline error with no scope open as uncapturederror', () => {
    const fake = fakeGpuDevice();
    const seen: string[] = [];
    fake.device.addEventListener('uncapturederror', (e) => seen.push((e as GPUUncapturedErrorEvent).error.message));
    fake.failPipelines = true;
    fake.device.createRenderPipeline({} as GPURenderPipelineDescriptor);
    expect(seen).toEqual(['invalid pipeline']);
  });

  it('hands a dispatched uncapturederror to its listeners, as the renderer re-raises a scoped one', () => {
    const { device } = fakeGpuDevice();
    const seen: string[] = [];
    device.addEventListener('uncapturederror', (e) => seen.push((e as GPUUncapturedErrorEvent).error.message));
    device.dispatchEvent(Object.assign(new Event('uncapturederror'), { error: { message: 're-raised' } }));
    expect(seen).toEqual(['re-raised']);
  });
});
