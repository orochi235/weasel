import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CursorSink, CursorSpec } from '@weasel-js/cursor';
import type { ToolsApi } from '../tools/overlayBinding';
import { useToolCursor } from './useToolCursor';

const toolsWith = (cursor: CursorSpec): ToolsApi =>
  ({ active: 'brush', routed: 'brush', hotkeyEngaged: null, registry: { brush: { id: 'brush', cursor } } }) as unknown as ToolsApi;

describe('useToolCursor', () => {
  it('writes the base again when only a painted cursor\'s mark changes', () => {
    const setBase = vi.fn();
    const sink: CursorSink = { setBase, setOverride: vi.fn() };
    const { rerender } = renderHook(({ tools }) => useToolCursor(sink, tools, null, undefined), {
      initialProps: { tools: toolsWith({ glyph: 'crosshair', mark: 'add', worldRadius: 4 }) },
    });
    rerender({ tools: toolsWith({ glyph: 'crosshair', mark: 'remove', worldRadius: 4 }) });
    expect(setBase.mock.calls.at(-1)?.[0]).toMatchObject({ kind: 'painted', mark: 'remove' });
  });

  it('writes no tool cursor when input routes to no tool', () => {
    const setBase = vi.fn();
    const sink: CursorSink = { setBase, setOverride: vi.fn() };
    const tools = { ...toolsWith('crosshair'), routed: null } as ToolsApi;
    renderHook(() => useToolCursor(sink, tools, null, 'default'));
    expect(setBase).toHaveBeenLastCalledWith(null, 'default');
  });

  it('logs a throwing cursor() once per tool and writes no tool cursor', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const setBase = vi.fn();
      const sink: CursorSink = { setBase, setOverride: vi.fn() };
      const tools = toolsWith((() => { throw new Error('no mode'); }) as unknown as CursorSpec);
      const { rerender } = renderHook(({ rest }) => useToolCursor(sink, tools, null, rest), { initialProps: { rest: 'default' } });
      rerender({ rest: 'auto' });
      expect(setBase).toHaveBeenLastCalledWith(null, 'auto');
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0]![0])).toContain('"brush"');
    } finally {
      error.mockRestore();
    }
  });
});
