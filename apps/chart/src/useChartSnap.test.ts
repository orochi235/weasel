import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { FeatureEntry, FeaturePreset } from '@weasel-js/core';
import { chartPrefs } from './prefs';
import { useChartSnap } from './useChartSnap';

afterEach(() => {
  // The store caches what it read, so clearing storage alone would leak prefs into the next test.
  chartPrefs().reset();
  localStorage.clear();
});

const presetOf = (features: readonly FeatureEntry[]) =>
  features.find((f): f is FeaturePreset => typeof f === 'object' && f !== null);
const sourceIds = (preset: FeaturePreset | undefined) => (preset?.snapSources ?? []).map((s) => s.id).sort();

describe('useChartSnap', () => {
  it('starts with no grid, no grid snap, and alignment and spacing snaps on', () => {
    const { result } = renderHook(() => useChartSnap());
    expect(result.current.gridLayer).toBeUndefined();
    expect(result.current.snap.sources ?? []).toEqual([]);
    expect(result.current.features[0]).toBe('draw');
    expect(sourceIds(presetOf(result.current.features))).toEqual(['alignment', 'spacing']);
  });

  it('draws the grid and snaps to it while their prefs are on', () => {
    const { result } = renderHook(() => useChartSnap());
    act(() => { chartPrefs().set('view.gridVisible', true); });
    expect(result.current.gridLayer).toBeDefined();
    expect(result.current.snap.sources ?? []).toEqual([]);
    act(() => { chartPrefs().set('view.snapToGrid', true); });
    expect(result.current.snap.sources?.map((s) => s.id)).toEqual(['grid']);
  });

  it('keeps alignment without spacing and its readout, and drops the preset with both off', () => {
    const { result } = renderHook(() => useChartSnap());
    act(() => { chartPrefs().set('view.spacingSnap', false); });
    expect(sourceIds(presetOf(result.current.features))).toEqual(['alignment']);
    expect(presetOf(result.current.features)?.contributions ?? []).toEqual([]);
    act(() => { chartPrefs().set('view.alignmentSnap', false); });
    expect(result.current.features).toEqual(['draw']);
  });

  it('keeps every value by identity across renders until its prefs change', () => {
    act(() => {
      chartPrefs().set('view.gridVisible', true);
      chartPrefs().set('view.snapToGrid', true);
    });
    const { result, rerender } = renderHook(() => useChartSnap());
    const first = result.current;
    rerender();
    expect(result.current.gridLayer).toBe(first.gridLayer);
    expect(result.current.snap).toBe(first.snap);
    expect(result.current.features).toBe(first.features);
    act(() => { chartPrefs().set('view.gridSpacing', 24); });
    expect(result.current.snap).not.toBe(first.snap);
    expect(result.current.gridLayer).not.toBe(first.gridLayer);
    expect(result.current.features).toBe(first.features);
  });
});
