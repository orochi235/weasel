import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { EnabledPresets } from './features';
import { useViewportWithoutView } from './useViewportWithoutView';

const none = new Set<string>() as unknown as EnabledPresets;

describe('useViewportWithoutView', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not warn for inertia, which the hand tool reads without the view preset', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderHook(() => useViewportWithoutView({ inertia: true, recenter: () => {} }, none));
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns for wheel navigation without the view preset', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderHook(() => useViewportWithoutView({ pan: false }, none));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
