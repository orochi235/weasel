import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEyedropperTool } from './useEyedropperTool';
import type { Action } from 'interactions/actions/registry';
import type { ActionDeps } from 'interactions/actions/invoker';
import type { NodeId } from 'core/scene/types';

/** Pull the tool's own `eyedropper.pick` action off `ToolDef.actions`. */
function pickActionOf(tool: { actions?: readonly Action[] }): Action {
  const action = tool.actions?.find((a) => a.id === 'eyedropper.pick');
  if (!action) throw new Error('eyedropper.pick not declared on the tool');
  return action;
}

/** Deps with a `nodeAtPoint` that reports `id` for every point, or nothing. */
function depsHitting(id: string | null): ActionDeps {
  return { nodeAtPoint: () => (id === null ? null : (id as NodeId)) } as unknown as ActionDeps;
}

function run(tool: { actions?: readonly Action[] }, deps: ActionDeps, params: Record<string, unknown>) {
  const action = pickActionOf(tool);
  if (action.invoker?.timing !== 'immediate') throw new Error('expected an immediate invoker');
  action.invoker.run(deps, params);
}

describe('useEyedropperTool', () => {
  it('declares id, I keybinding, alt hotkey, crosshair cursor', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null }),
    );
    expect(result.current.id).toBe('eyedropper');
    expect(result.current.keybinding).toEqual({ key: 'I' });
    // hotkey lives on the ToolDef (reflection escape hatch) rather than on
    // the runtime Tool interface since Tool.hotkey was removed.
    expect((result.current.def as any)?.hotkey).toBe('alt');
    // `defineTool` wraps a string cursor in a resolver. jsdom draws no cursor,
    // so this checks the string handed to the host, not what renders.
    const cursor = typeof result.current.cursor === 'function'
      ? result.current.cursor({} as never)
      : result.current.cursor;
    expect(cursor).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(cursor).toMatch(/, crosshair$/);
  });

  it('binds one click route to its own action, and nothing else', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null }),
    );
    expect(result.current.bindings).toEqual([
      { spec: { kind: 'click' }, actionId: 'eyedropper.pick' },
    ]);
    // The `pointerDown` claim gate is gone: it existed only to beat the other
    // dispatch pipeline's select tool to the press.
    expect(result.current.bindings?.some((b) => b.spec.kind === 'pointerDown')).toBe(false);
    expect((result.current.def as any)?.initial).toBeUndefined();
  });

  it('the pick action is eligibility-gated on samples-color', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null }),
    );
    expect(pickActionOf(result.current).eligible).toEqual({ capability: 'samples-color' });
  });

  it('click on a node calls onPick with colorOf(id)', () => {
    const onPick = vi.fn();
    const colorOf = vi.fn((id: string) => (id === 'r1' ? '#ff0000' : null));
    const { result } = renderHook(() => useEyedropperTool({ onPick, colorOf }));
    run(result.current, depsHitting('r1'), { pressX: 5, pressY: 5 });
    expect(colorOf).toHaveBeenCalledWith('r1');
    expect(onPick).toHaveBeenCalledExactlyOnceWith('#ff0000');
  });

  it('samples at the press point, not the release point', () => {
    // A click can drift up to the drag threshold between press and release,
    // which is enough to land on a different node.
    const seen: Array<{ x: number; y: number }> = [];
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => '#fff' }),
    );
    const deps = {
      nodeAtPoint: (p: { x: number; y: number }) => { seen.push(p); return 'r1' as NodeId; },
    } as unknown as ActionDeps;
    run(result.current, deps, { pressX: 10, pressY: 10, worldX: 13, worldY: 13 });
    expect(seen).toEqual([{ x: 10, y: 10 }]);
  });

  it('colorOf returning null forwards null to onPick', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => null }),
    );
    run(result.current, depsHitting('r1'), { pressX: 0, pressY: 0 });
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('click on empty does NOT call onPick', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => '#fff' }),
    );
    run(result.current, depsHitting(null), { pressX: 0, pressY: 0 });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('no nodeAtPoint dep registered → no pick, no throw', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => '#fff' }),
    );
    run(result.current, {} as ActionDeps, { pressX: 0, pressY: 0 });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('hotkey: null override removes the hotkey trigger', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null, hotkey: null }),
    );
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
    const { result, rerender } = renderHook(
      ({ onPick, colorOf }) => useEyedropperTool({ onPick, colorOf }),
      { initialProps: { onPick: onPick1, colorOf: () => '#111' } },
    );
    rerender({ onPick: onPick2, colorOf: () => '#222' });
    run(result.current, depsHitting('r1'), { pressX: 0, pressY: 0 });
    expect(onPick1).not.toHaveBeenCalled();
    expect(onPick2).toHaveBeenCalledWith('#222');
  });
});
