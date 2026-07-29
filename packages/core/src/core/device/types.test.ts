import { describe, it, expect } from 'vitest';
import {
  resolveDeviceProfile,
  DEFAULT_DEVICE_PROFILE,
  COARSE_TARGET_SCALE,
} from './types';

describe('resolveDeviceProfile', () => {
  const fine = { coarsePointer: false, canHover: true, dpr: 1 };
  const coarse = { coarsePointer: true, canHover: false, dpr: 3 };

  it('derives targetScale 1 for a fine pointer', () => {
    expect(resolveDeviceProfile(fine)).toEqual({ ...fine, targetScale: 1 });
  });

  it('derives targetScale COARSE_TARGET_SCALE for a coarse pointer', () => {
    expect(resolveDeviceProfile(coarse)).toEqual({
      ...coarse,
      targetScale: COARSE_TARGET_SCALE,
    });
  });

  it('lets an override flip coarsePointer and re-derives targetScale', () => {
    const r = resolveDeviceProfile(fine, { coarsePointer: true });
    expect(r.coarsePointer).toBe(true);
    expect(r.targetScale).toBe(COARSE_TARGET_SCALE);
  });

  it('honors an explicit targetScale override instead of re-deriving', () => {
    const r = resolveDeviceProfile(fine, { coarsePointer: true, targetScale: 4 });
    expect(r.targetScale).toBe(4);
  });

  it('leaves unspecified fields alone', () => {
    const r = resolveDeviceProfile(coarse, { canHover: true });
    expect(r.canHover).toBe(true);
    expect(r.dpr).toBe(3);
    expect(r.coarsePointer).toBe(true);
  });

  it('DEFAULT_DEVICE_PROFILE is a fine-pointer, hover-capable, density-1 device', () => {
    expect(DEFAULT_DEVICE_PROFILE).toEqual({
      coarsePointer: false,
      canHover: true,
      dpr: 1,
      targetScale: 1,
    });
  });
});
