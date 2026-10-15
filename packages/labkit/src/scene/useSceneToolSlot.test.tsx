import { renderHook } from '@testing-library/react';
import type { ToolsApi } from '@weasel-js/core';
import { describe, expect, it, vi } from 'vitest';
import { useSceneToolSlot } from './useSceneToolSlot';

/** A canvas tool slot whose registry holds `ids`, its active tool `active`. */
function tools(active: string | null, ids = ['select', 'pen']): ToolsApi {
  return {
    active,
    registry: Object.fromEntries(ids.map((id) => [id, {}])),
    setActive: vi.fn(),
  } as unknown as ToolsApi;
}

describe('useSceneToolSlot', () => {
  it("keeps a slot naming a tool the canvas lacks while the canvas's tool settles", () => {
    const setActiveTool = vi.fn();
    const { result } = renderHook(() => useSceneToolSlot({ activeToolId: 'brush', setActiveTool }));
    // A canvas reports before its default tool is active, then again once it is.
    result.current(tools(null));
    result.current(tools('select'));
    expect(setActiveTool).not.toHaveBeenCalled();
  });

  it("moves the slot when the canvas's own hotkey changes tool", () => {
    const setActiveTool = vi.fn();
    const { result } = renderHook(() => useSceneToolSlot({ activeToolId: 'select', setActiveTool }));
    result.current(tools('select'));
    result.current(tools('pen'));
    expect(setActiveTool).toHaveBeenCalledWith('pen');
  });
});
