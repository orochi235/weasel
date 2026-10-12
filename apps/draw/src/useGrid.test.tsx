import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { drawPrefs } from './prefs';
import { useGrid } from './useGrid';

const PAGE = { width: 600, height: 800 };
const mount = () => renderHook(() => useGrid(PAGE, '#ffffff'));

beforeEach(() => act(() => drawPrefs().reset()));

describe('useGrid', () => {
  it('starts hidden and not snapping, as a first run has no preference set', () => {
    const { result } = mount();
    expect(result.current.commands.gridVisible).toBe(false);
    expect(result.current.commands.snapToGrid).toBe(false);
    expect(result.current.layer).toBeUndefined();
    expect(result.current.snapPoint).toBeUndefined();
  });

  it('shows the grid when the preference says so', () => {
    act(() => drawPrefs().set('view.gridVisible', true));
    expect(mount().result.current.layer).toBeDefined();
  });

  it('writes the toggles to the preferences', () => {
    const { result } = mount();
    act(() => result.current.commands.toggleGrid());
    act(() => result.current.commands.toggleSnap());
    expect(drawPrefs().get('view.gridVisible')).toBe(true);
    expect(drawPrefs().get('view.snapToGrid')).toBe(true);
    expect(result.current.commands.gridVisible).toBe(true);
    act(() => result.current.commands.toggleGrid());
    expect(drawPrefs().get('view.gridVisible')).toBe(false);
  });

  it('snaps to the grid density the preference names', () => {
    act(() => {
      drawPrefs().set('view.snapToGrid', true);
      drawPrefs().set('view.gridDensity', 36);
    });
    const { result } = mount();
    expect(result.current.snapPoint!({ x: 50, y: 19 })).toEqual({ x: 36, y: 36 });
    expect(result.current.snap).toBeDefined();
    act(() => drawPrefs().set('view.gridDensity', 8));
    expect(result.current.snapPoint!({ x: 50, y: 19 })).toEqual({ x: 48, y: 16 });
  });
});
