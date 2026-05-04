import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTextTool } from './useTextTool';
import type { ToolCtx } from '../types';

function makeCtx(over: Partial<ToolCtx<undefined>> = {}): ToolCtx<undefined> {
  return {
    worldX: 100,
    worldY: 200,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [], applyClick: vi.fn() } as unknown as ToolCtx['selection'],
    adapter: {},
    applyBatch: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: undefined,
    ...over,
  };
}

function pe(): PointerEvent {
  const e = new Event('click') as PointerEvent;
  Object.assign(e, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
  return e;
}

describe('useTextTool', () => {
  it('declares id "text", T keybinding, text cursor', () => {
    const { result } = renderHook(() =>
      useTextTool({ commitInsert: () => ({ id: 'x', x: 0, y: 0, width: 0, height: 0, text: '' }) }),
    );
    expect(result.current.id).toBe('text');
    expect(result.current.keybinding).toBe('T');
    expect(result.current.cursor).toBe('text');
  });

  it('pointer.onClick calls commitInsert with the click point and dispatches an InsertOp via applyBatch', () => {
    const commitInsert = vi.fn((p: { worldX: number; worldY: number }) => ({
      id: 't1',
      x: p.worldX,
      y: p.worldY,
      width: 120,
      height: 32,
      text: '',
    }));
    const applyBatch = vi.fn();
    const { result } = renderHook(() => useTextTool({ commitInsert }));
    const decision = result.current.pointer!.onClick!(pe(), makeCtx({ worldX: 50, worldY: 75, applyBatch }));
    expect(decision).toBe('claim');
    expect(commitInsert).toHaveBeenCalledWith({ worldX: 50, worldY: 75 });
    expect(applyBatch).toHaveBeenCalledTimes(1);
    const [ops, label] = applyBatch.mock.calls[0] as [Array<{ apply: unknown; invert: unknown }>, string];
    expect(label).toBe('Insert text');
    expect(ops.length).toBe(1);
    expect(typeof ops[0].invert).toBe('function');
  });

  it('pointer.onClick with commitInsert returning null is a no-op pass', () => {
    const commitInsert = vi.fn(() => null);
    const applyBatch = vi.fn();
    const { result } = renderHook(() => useTextTool({ commitInsert }));
    const decision = result.current.pointer!.onClick!(pe(), makeCtx({ applyBatch }));
    expect(decision).toBe('pass');
    expect(applyBatch).not.toHaveBeenCalled();
  });

  it('has no drag handlers (click-only tool)', () => {
    const { result } = renderHook(() =>
      useTextTool({ commitInsert: () => ({ id: 'x', x: 0, y: 0, width: 0, height: 0, text: '' }) }),
    );
    expect(result.current.drag).toBeUndefined();
  });
});
