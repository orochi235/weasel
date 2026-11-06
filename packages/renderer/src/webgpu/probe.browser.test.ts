import { expect, it } from 'vitest';

it('headless chromium hands out a WebGPU device that can render and read back', async () => {
  const gpu = (navigator as any).gpu;
  console.log('navigator.gpu', !!gpu);
  expect(gpu).toBeTruthy();
  const adapter = await gpu.requestAdapter();
  console.log('adapter', adapter && JSON.stringify(adapter.info ?? {}));
  expect(adapter).toBeTruthy();
  const device = await adapter.requestDevice();
  const tex = device.createTexture({ size: [4, 4], format: 'rgba8unorm', usage: 0x10 | 0x01 });
  const buf = device.createBuffer({ size: 256 * 4, usage: 0x01 | 0x08 });
  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({
    colorAttachments: [{ view: tex.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 1, g: 0.5, b: 0, a: 1 } }],
  });
  pass.end();
  enc.copyTextureToBuffer({ texture: tex }, { buffer: buf, bytesPerRow: 256 }, [4, 4]);
  device.queue.submit([enc.finish()]);
  await buf.mapAsync(1);
  const px = Array.from(new Uint8Array(buf.getMappedRange()).slice(0, 4));
  console.log('pixel', px);
  expect(px).toEqual([255, 128, 0, 255]);
});
