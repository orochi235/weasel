import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEyedropperTool } from './useEyedropperTool';
import type { HitResult } from '../../routing/hitResult';
import type { ToolCtx } from '../../types';

function makeCtx(target: HitResult): ToolCtx<null> {
  return {
    worldX: 0, worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    target,
    selection: {} as never,
    adapter: null,
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: null,
  };
}

const nodeHit = (id = 'r1', kind = 'rect'): HitResult => ({
  category: 'node', kind, id: id as never, pose: {}, data: {},
});
const emptyHit = (): HitResult => ({ category: 'empty', kind: 'empty' });

describe('useEyedropperTool', () => {
  it('declares id, I keybinding, alt hotkey, crosshair cursor', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null }),
    );
    expect(result.current.id).toBe('eyedropper');
    expect(result.current.keybinding).toEqual({ key: 'I' });
    // hotkey lives on the ToolDef (reflection escape hatch) rather than on
    // the runtime Tool interface since Task 10 removed Tool.hotkey.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.current.def as any)?.hotkey).toBe('alt');
    // cursor is a resolver function from defineTool; call it with a minimal ctx.
    const cursor = typeof result.current.cursor === 'function'
      ? result.current.cursor(makeCtx(emptyHit()))
      : result.current.cursor;
    expect(cursor).toBe('crosshair');
  });

  it('click on a rect hit calls onPick with colorOf(id)', () => {
    const onPick = vi.fn();
    const colorOf = vi.fn((id: string) => id === 'r1' ? '#ff0000' : null);
    const { result } = renderHook(() => useEyedropperTool({ onPick, colorOf }));
    const ctx = makeCtx(nodeHit('r1', 'rect'));
    const decision = result.current.pointer!.onClick!(new Event('click') as PointerEvent, ctx);
    expect(decision).toBe('claim');
    expect(colorOf).toHaveBeenCalledWith('r1');
    expect(onPick).toHaveBeenCalledWith('#ff0000');
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('click on a text hit routes through the same action', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => '#123456' }),
    );
    const ctx = makeCtx(nodeHit('t1', 'text'));
    result.current.pointer!.onClick!(new Event('click') as PointerEvent, ctx);
    expect(onPick).toHaveBeenCalledWith('#123456');
  });

  it('click on a path hit routes through the same action', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => '#abcdef' }),
    );
    const ctx = makeCtx(nodeHit('p1', 'path'));
    result.current.pointer!.onClick!(new Event('click') as PointerEvent, ctx);
    expect(onPick).toHaveBeenCalledWith('#abcdef');
  });

  it('click on an unknown node kind falls through to the * route', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => '#000' }),
    );
    const ctx = makeCtx(nodeHit('x1', 'sprite'));
    result.current.pointer!.onClick!(new Event('click') as PointerEvent, ctx);
    expect(onPick).toHaveBeenCalledWith('#000');
  });

  it('colorOf returning null forwards null to onPick', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => null }),
    );
    const ctx = makeCtx(nodeHit('r1', 'rect'));
    result.current.pointer!.onClick!(new Event('click') as PointerEvent, ctx);
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('click on empty does NOT call onPick', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => '#fff' }),
    );
    const ctx = makeCtx(emptyHit());
    const decision = result.current.pointer!.onClick!(new Event('click') as PointerEvent, ctx);
    expect(onPick).not.toHaveBeenCalled();
    // none() resolves to a 'pass' decision in the routing factory.
    expect(decision).toBe('pass');
  });

  it('drag channel is unbound (no onStart)', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null }),
    );
    // defineTool only attaches drag handlers when at least one drag route exists.
    // No drag routes here → tool.drag is undefined.
    expect(result.current.drag).toBeUndefined();
  });

  it('hotkey: null override removes the hotkey trigger', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null, hotkey: null }),
    );
    // hotkey lives on the ToolDef (reflection escape hatch) rather than on
    // the runtime Tool interface since Task 10 removed Tool.hotkey.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.current.def as any)?.hotkey).toBeUndefined();
  });

  it('keybinding: null override removes the keybinding', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null, keybinding: null }),
    );
    expect(result.current.keybinding).toBeUndefined();
  });

  it('uses the latest onPick / colorOf via refs (no stale closure)', () => {
    const onPick1 = vi.fn();
    const onPick2 = vi.fn();
    const colorOf1 = () => '#111';
    const colorOf2 = () => '#222';
    const { result, rerender } = renderHook(
      ({ onPick, colorOf }) => useEyedropperTool({ onPick, colorOf }),
      { initialProps: { onPick: onPick1, colorOf: colorOf1 } },
    );
    rerender({ onPick: onPick2, colorOf: colorOf2 });
    const ctx = makeCtx(nodeHit('r1', 'rect'));
    result.current.pointer!.onClick!(new Event('click') as PointerEvent, ctx);
    expect(onPick1).not.toHaveBeenCalled();
    expect(onPick2).toHaveBeenCalledWith('#222');
  });
});
