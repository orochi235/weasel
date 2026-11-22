import { describe, expect, it, vi } from 'vitest';
import { identityNdcGroups } from './testNdc';

describe('identityNdcGroups', () => {
  it('makes one viewport buffer per device, however many draws ask for it', () => {
    const createBuffer = vi.fn(() => ({}));
    const device = {
      createBuffer, createBindGroup: () => ({}), queue: { writeBuffer: () => {} },
    } as unknown as GPUDevice;
    const pipeline = { getBindGroupLayout: () => ({}) } as unknown as GPURenderPipeline;
    identityNdcGroups(device, pipeline, []);
    identityNdcGroups(device, pipeline, []);
    expect(createBuffer).toHaveBeenCalledTimes(1);
  });
});
