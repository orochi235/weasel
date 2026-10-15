import { renderHook } from '@testing-library/react';
import type { ToolsApi } from '@weasel-js/core';
import { describe, expect, it, vi } from 'vitest';
import { useSceneToolSlot } from './useSceneToolSlot';

function canvasTools(active: string | null): ToolsApi {
  const tools = {
    active,
    registry: { select: {}, pen: {} },
    setActive: vi.fn((id: string) => { tools.active = id; }),
  };
  return tools as unknown as ToolsApi;
}

describe('useSceneToolSlot', () => {
  it("keeps a slot naming a tool the canvas lacks while the canvas settles on its own first tool", () => {
    const slot = { activeToolId: 'lengthen', setActiveTool: vi.fn() };
    const { result } = renderHook(() => useSceneToolSlot(slot));
    result.current(canvasTools(null));
    result.current(canvasTools(null));
    result.current(canvasTools('select'));
    expect(slot.setActiveTool).not.toHaveBeenCalled();
  });

  it('hands the slot a tool the canvas changes to after it has one', () => {
    const slot = { activeToolId: 'lengthen', setActiveTool: vi.fn() };
    const { result } = renderHook(() => useSceneToolSlot(slot));
    result.current(canvasTools(null));
    result.current(canvasTools('select'));
    result.current(canvasTools('pen'));
    expect(slot.setActiveTool).toHaveBeenCalledWith('pen');
  });

  it('pushes the slot onto a settling canvas, and leaves the slot alone while it catches up', () => {
    const slot = { activeToolId: 'pen', setActiveTool: vi.fn() };
    const { result } = renderHook(() => useSceneToolSlot(slot));
    const mounting = canvasTools(null);
    result.current(mounting);
    expect(mounting.setActive).toHaveBeenCalledWith('pen');
    result.current(canvasTools('select'));
    result.current(canvasTools('pen'));
    expect(slot.setActiveTool).not.toHaveBeenCalled();
  });
});
