import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { drawPrefs } from './prefs';
import { useSpacingHints } from './useSpacingHints';

beforeEach(() => act(() => drawPrefs().reset()));

describe('useSpacingHints', () => {
  it('turns the spacing hints preset on, with its readout, by default', () => {
    const { result } = renderHook(() => useSpacingHints());
    expect(result.current?.id).toBe('spacingHints');
    expect(result.current?.moveBehaviors).toHaveLength(1);
    expect(result.current?.contributions?.map((c) => c.id)).toContain('distanceReadout');
  });

  it('offers nothing while the preference is off', () => {
    act(() => drawPrefs().set('view.spacingHints', false));
    const { result } = renderHook(() => useSpacingHints());
    expect(result.current).toBeUndefined();
  });
});
