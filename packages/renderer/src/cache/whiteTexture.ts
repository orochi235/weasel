import type { GpuDevice, GpuTexture } from '../gpu/types';

/** The 1x1 opaque white texture a batch flush binds when its run samples no
 *  image. NEAREST both ways: one texel, so there is nothing to filter, and a
 *  mipmap filter on a texture with no mipmaps is incomplete. */
export function createWhiteTexture(gpu: GpuDevice): GpuTexture {
  return gpu.createTexture('rgba8', { min: 'nearest', mag: 'nearest', wrapS: 'clamp', wrapT: 'clamp' },
    { width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) });
}
