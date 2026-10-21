import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { drawPrefs } from './prefs';
import { useSpacingHints } from './useSpacingHints';

beforeEach(() => act(() => drawPrefs().reset()));

describe('useSpacingHints', () => {
  it('turns the spacing hints preset on, with its equal-spacing snap and readout, by default', () => {
    const { result } = renderHook(() => useSpacingHints());
    expect(result.current?.id).toBe('spacingHints');
    expect(result.current?.snapSources?.map((s) => s.id)).toEqual(['spacing']);
    expect(result.current?.contributions?.map((c) => c.id)).toContain('distanceReadout');
  });

  it('offers nothing while the preference is off', () => {
    act(() => drawPrefs().set('view.spacingHints', false));
    const { result } = renderHook(() => useSpacingHints());
    expect(result.current).toBeUndefined();
  });
});
