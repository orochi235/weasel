import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { KitSettingsProvider } from '@weasel-js/react';
import { ANCHOR_HIT_BASE_PX, HANDLE_BASE_PX, ROTATION_HANDLE_BASE_PX, targetSizesPx } from './targets';
import { useTargetBasePx } from './useTargetBasePx';

describe('targetSizesPx', () => {
  it('multiplies the device scale onto a base that replaces the constants', () => {
    expect(targetSizesPx(2, { handle: 10 })).toEqual({
      handle: 20, anchor: ANCHOR_HIT_BASE_PX * 2, rotationDistance: ROTATION_HANDLE_BASE_PX * 2,
    });
  });
});

describe('useTargetBasePx', () => {
  it('reads the targets kit settings', () => {
    const { result } = renderHook(() => useTargetBasePx(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <KitSettingsProvider value={{ targets: { handlePx: 12, anchorHitPx: 9, rotationDistancePx: 30 } }}>{children}</KitSettingsProvider>
      ),
    });
    expect(targetSizesPx(1, result.current)).toEqual({ handle: 12, anchor: 9, rotationDistance: 30 });
  });

  it('leaves the constants in place with no provider', () => {
    const { result } = renderHook(() => useTargetBasePx());
    expect(targetSizesPx(1, result.current)).toEqual({
      handle: HANDLE_BASE_PX, anchor: ANCHOR_HIT_BASE_PX, rotationDistance: ROTATION_HANDLE_BASE_PX,
    });
  });
});
