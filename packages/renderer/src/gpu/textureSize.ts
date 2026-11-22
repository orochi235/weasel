import type { GpuImageSource, GpuTextureData } from './types';

/** The texels `data` holds across and down. */
export function textureSize(data: GpuTextureData): { width: number; height: number } {
  if (!('source' in data)) return { width: data.width, height: data.height };
  const source = data.source as GpuImageSource & { naturalWidth?: number; naturalHeight?: number };
  return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
}
