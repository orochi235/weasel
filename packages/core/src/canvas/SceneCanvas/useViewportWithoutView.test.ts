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
    renderHook(() => useViewportWithoutView({ pan: { axis: 'x' } }, none));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn when viewport only switches navigation off', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderHook(() => useViewportWithoutView({ pan: false, zoom: false, touchZoom: false, edgePan: false }, none));
    expect(warn).not.toHaveBeenCalled();
  });
});
