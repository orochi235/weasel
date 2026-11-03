export const MIMALLOC_TAG: number;
export const MIMALLOC_REGION: string;
export function retagMimalloc(): void;
export function nativeRegions(pid?: number): {
  footprintMB: number | undefined;
  mimallocDirtyMB: number;
  v8DirtyMB: number;
  systemMallocDirtyMB: number;
  ioAcceleratorDirtyMB: number;
} | undefined;
