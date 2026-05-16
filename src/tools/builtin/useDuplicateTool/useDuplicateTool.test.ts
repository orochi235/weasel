import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDuplicateTool } from './useDuplicateTool';
import type { ToolCtx } from '../../types';

function makeCtx(): ToolCtx<undefined> {
  return {
    worldX: 0, worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: ['a'] } as any,
    adapter: {},
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: undefined,
  };
}

function keyEvent(key: string, opts: { metaKey?: boolean; ctrlKey?: boolean; preventDefault?: () => void } = {}): KeyboardEvent {
  const e = new Event('keydown') as KeyboardEvent;
  Object.assign(e, { key, metaKey: false, ctrlKey: false, preventDefault: () => {}, ...opts });
  return e;
}

describe('useDuplicateTool', () => {
  it('declares id "duplicate" and no switch keybinding (handles meta+d via the keyboard channel)', () => {
    const adapter = { getSelection: () => ['a'], getNode: () => ({ id: 'a' }), cloneNode: (o: any) => ({ ...o, id: 'a2' }), applyOps: vi.fn() } as any;
    const { result } = renderHook(() => useDuplicateTool(adapter, {}));
    expect(result.current.id).toBe('duplicate');
    expect(result.current.keybinding).toBeUndefined();
  });

  it('claims meta+d / ctrl+d; passes plain d', () => {
    const adapter = { getSelection: () => ['a'], getPose: () => ({}), cloneNode: (_id: string) => ({ id: 'a2' }), applyOps: vi.fn() } as any;
    const { result } = renderHook(() => useDuplicateTool(adapter, {}));
    expect(result.current.keyboard!.onDown!(keyEvent('d', { metaKey: true }), makeCtx())).toBe('claim');
    expect(result.current.keyboard!.onDown!(keyEvent('d', { ctrlKey: true }), makeCtx())).toBe('claim');
    expect(result.current.keyboard!.onDown!(keyEvent('d'), makeCtx())).toBe('pass');
  });
});
