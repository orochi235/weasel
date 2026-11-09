import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CursorSink, CursorSpec } from '@weasel-js/cursor';
import type { ToolsApi } from '../tools/overlayBinding';
import { useToolCursor } from './useToolCursor';

const toolsWith = (cursor: CursorSpec): ToolsApi =>
  ({ active: 'brush', hotkeyEngaged: null, registry: { brush: { id: 'brush', cursor } } }) as unknown as ToolsApi;

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
});
