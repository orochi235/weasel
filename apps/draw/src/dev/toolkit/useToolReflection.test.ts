import { act, renderHook } from '@testing-library/react';
import type { Tool, ToolsApi } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { toolSlotsSignature, useToolReflection } from './useToolReflection';

const tool = (id: string): Tool => ({ id, bindings: [] }) as unknown as Tool;

function api(active: string | null, routed: string | null = active): ToolsApi {
  return {
    registry: { ellipse: tool('ellipse'), select: tool('select') },
    ambient: [],
    active,
    routed,
  } as unknown as ToolsApi;
}

describe('useToolReflection', () => {
  it("reports the canvas's routed tool, not the first registry id", () => {
    const { result } = renderHook(() => useToolReflection());
    act(() => result.current.onToolsCreated(api('select')));
    expect(result.current.activeToolId).toBe('select');
  });

  it('follows the active tool as it changes, and prefers a held tool', () => {
    const { result } = renderHook(() => useToolReflection());
    act(() => result.current.onToolsCreated(api('select')));
    act(() => result.current.onToolsCreated(api('ellipse')));
    expect(result.current.activeToolId).toBe('ellipse');
    act(() => result.current.onToolsCreated(api('ellipse', 'select')));
    expect(result.current.activeToolId).toBe('select');
    act(() => result.current.onToolsCreated(api(null)));
    expect(result.current.activeToolId).toBe('');
  });
});

describe('toolSlotsSignature', () => {
  const slots = (registry: string[], ambient: string[]) => ({
    registry: Object.fromEntries(registry.map((id) => [id, tool(id)])),
    ambient: ambient.map(tool),
  });

  it('changes when only the ambient slot does', () => {
    expect(toolSlotsSignature(slots(['select'], ['resize']))).not.toBe(toolSlotsSignature(slots(['select'], ['resize', 'rotate'])));
  });

  it('tells a tool in the registry from the same id in the ambient slot', () => {
    expect(toolSlotsSignature(slots(['hand'], []))).not.toBe(toolSlotsSignature(slots([], ['hand'])));
  });
});
