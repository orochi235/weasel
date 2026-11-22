import type { GpuVertexAttribute } from './types';

/** A vertex's bytes when its attributes are packed end to end: what a stride of 0 means on every backend. */
export function packedStride(attributes: readonly GpuVertexAttribute[]): number {
  return attributes.reduce((end, a) => Math.max(end, a.offset + 4 * a.components), 0);
}
