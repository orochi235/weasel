import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTextTool } from './useTextTool';
import { makeCtx } from '../testUtils';

/**
 * Phase 14e Task 3.5: useTextTool is now a thin declarative wrapper. The
 * drag-to-insert path is owned by the dispatcher's `insertAction` (kind:
 * 'text'); click-to-enter-edit is owned by `enterTextEditAction`. There is
 * no local route-table drag handler and no local pointer.onClick handler.
 * End-to-end behavior is covered by the dispatcher-side action tests and by
 * the SceneCanvas smoke test.
 */
describe('useTextTool surface', () => {
  it('declares id "text" and text cursor', () => {
    const { result } = renderHook(() =>
      useTextTool({ pointInsert: () => ({ id: 't', x: 0, y: 0, width: 0, height: 0, text: '' }) }),
    );
    expect(result.current.id).toBe('text');
    // keybinding field removed from ToolDef; key activation is now registered
    // as a `tool.shortcut.text` action via useKeybindings (Task 9).
    const cursor = typeof result.current.cursor === 'function'
      ? (result.current.cursor as (c: unknown) => string)(makeCtx())
      : result.current.cursor;
    expect(cursor).toBe('text');
  });

  it('declares insert (kind=text) and enterTextEdit bindings with bindingsOverrideDrag', () => {
    const { result } = renderHook(() =>
      useTextTool({ pointInsert: () => ({ id: 't', x: 0, y: 0, width: 0, height: 0, text: '' }) }),
    );
    const bindings = result.current.bindings;
    expect(bindings).toHaveLength(2);
    expect(bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'insert',
          opts: { params: { kind: 'text' } },
        }),
        expect.objectContaining({ actionId: 'enterTextEdit' }),
      ]),
    );
  });

  it('declares no route-table drag/pointer/overlay handlers (dispatcher-only)', () => {
    const { result } = renderHook(() =>
      useTextTool({ pointInsert: () => ({ id: 't', x: 0, y: 0, width: 0, height: 0, text: '' }) }),
    );
    expect(result.current.drag).toBeUndefined();
    expect(result.current.pointer).toBeUndefined();
    expect(result.current.overlay).toBeUndefined();
  });
});
