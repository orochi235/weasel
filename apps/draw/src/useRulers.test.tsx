import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DOCUMENT_SCOPE } from './documentUnits';
import { drawPrefs } from './prefs';
import { useRulers } from './useRulers';

beforeEach(() => act(() => drawPrefs().reset()));

describe('useRulers', () => {
  it('starts hidden, with the guides layer and snap source in place', () => {
    const { result } = renderHook(() => useRulers());
    expect(result.current.commands.rulersVisible).toBe(false);
    expect(result.current.rulers).toBeNull();
    expect(result.current.layer.id).toBe('guides');
    expect(result.current.snapSource.id).toBe('guides');
  });

  it('shows rulers reading the document in points and inches once toggled on', () => {
    const { result } = renderHook(() => useRulers());
    act(() => result.current.commands.toggleRulers());
    expect(drawPrefs().get('view.rulersVisible')).toBe(true);
    expect(result.current.rulers?.get().frame.scopes).toEqual([DOCUMENT_SCOPE]);
  });
});
