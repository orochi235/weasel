import { BufferUsage } from '../flags';

/** `groups` for groups 0 and 1, an empty one where group 1 is not given, and
 *  group 2's viewport fold left as the identity: for a test drawing a kit
 *  module through a pipeline of its own. */
export function identityNdcGroups(device: GPUDevice, pipeline: GPURenderPipeline, groups: readonly GPUBindGroup[]): GPUBindGroup[] {
  const ndc = device.createBuffer({ size: 16, usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST });
  device.queue.writeBuffer(ndc, 0, new Float32Array([1, 1, 0, 0]));
  const out = [...groups];
  while (out.length < 2) out.push(device.createBindGroup({ layout: pipeline.getBindGroupLayout(out.length), entries: [] }));
  out.push(device.createBindGroup({ layout: pipeline.getBindGroupLayout(2), entries: [{ binding: 0, resource: { buffer: ndc } }] }));
  return out;
}
