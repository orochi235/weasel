import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToolsApi } from '@weasel-js/core';
import { createModeRegistry, DEFAULT_MODES } from '@weasel-js/modes';
import { drawPrefs } from './prefs';
import { useLastTool } from './useLastTool';

function fakeTools(active: string | null, setActive = vi.fn()): ToolsApi {
  return { active, setActive, has: (id: string) => id !== 'gone' } as unknown as ToolsApi;
}

afterEach(() => act(() => drawPrefs().reset('tools.lastTool')));

describe('useLastTool', () => {
  it('activates the stored tool once the canvas has built its tools', () => {
    act(() => drawPrefs().set('tools.lastTool', 'rect'));
    const setActive = vi.fn();
    const { rerender } = renderHook(({ tools }) => useLastTool(tools), {
      initialProps: { tools: null as ToolsApi | null },
    });
    expect(setActive).not.toHaveBeenCalled();
    rerender({ tools: fakeTools('select', setActive) });
    expect(setActive).toHaveBeenCalledExactlyOnceWith('rect');
  });

  it('leaves the active tool alone when the stored one no longer exists', () => {
    act(() => drawPrefs().set('tools.lastTool', 'gone'));
    const setActive = vi.fn();
    renderHook(() => useLastTool(fakeTools('select', setActive)));
    expect(setActive).not.toHaveBeenCalled();
    expect(drawPrefs().get('tools.lastTool')).toBe('gone');
  });

  it('stores each tool the user switches to', () => {
    const { rerender } = renderHook(({ tools }) => useLastTool(tools), {
      initialProps: { tools: fakeTools('select') },
    });
    rerender({ tools: fakeTools('ellipse') });
    expect(drawPrefs().get('tools.lastTool')).toBe('ellipse');
  });

  it('stores no tool picked in a mode that names a default tool', () => {
    const modes = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const { rerender } = renderHook(({ tools }) => useLastTool(tools, modes), {
      initialProps: { tools: fakeTools('select') },
    });
    rerender({ tools: fakeTools('rect') });
    act(() => modes.setMode('path-edit'));
    rerender({ tools: fakeTools('anchors') });
    expect(drawPrefs().get('tools.lastTool')).toBe('rect');
  });
});
