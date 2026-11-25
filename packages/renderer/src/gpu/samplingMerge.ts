import type { GpuSampling } from './types';

/** `was` with the keys `sampling` sets; a key given as `undefined` leaves the old setting in place. */
export function mergeSampling(was: GpuSampling, sampling: Partial<GpuSampling>): GpuSampling {
  const next: { -readonly [K in keyof GpuSampling]: GpuSampling[K] } = { ...was };
  for (const key of Object.keys(sampling) as (keyof GpuSampling)[]) {
    const value = sampling[key];
    if (value !== undefined) (next as Record<string, unknown>)[key] = value;
  }
  return next;
}
