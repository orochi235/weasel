import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEyedropperTool } from './useEyedropperTool';
import type { Action } from '@weasel-js/routing';
import type { ActionDeps } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import { createElement } from 'react';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import type { Tool } from '../../overlayBinding';

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
  it('declares id, I keybinding, no hotkey, crosshair cursor', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null }),
    );
    expect(result.current.id).toBe('eyedropper');
    expect(result.current.keybinding).toEqual({ key: 'I' });
    // hotkey lives on the ToolDef (reflection escape hatch) rather than on
    // the runtime Tool interface since Tool.hotkey was removed.
    expect((result.current.def as any)?.hotkey).toBeUndefined();
    // `defineTool` wraps a string cursor in a resolver. jsdom draws no cursor,
    // so this checks the string handed to the host, not what renders.
    const cursor = typeof result.current.cursor === 'function'
      ? result.current.cursor()
      : result.current.cursor;
    expect(cursor).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(cursor).toMatch(/, crosshair$/);
  });

  it('binds one click route to its own action, and nothing else', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null }),
    );
    expect(result.current.bindings).toEqual([
      { spec: { kind: 'click', target: { kindOf: expect.any(Function) } }, actionId: 'eyedropper.pick', opts: { id: 'eyedropper.click' } },
    ]);
    // It consults the hit, so an exclusive chrome claim leaves it a candidate.
    const target = result.current.bindings![0].spec as { target: { kindOf: { readsAffordance: boolean } } };
    expect(target.target.kindOf.readsAffordance).toBe(true);
    // The `pointerDown` claim gate is gone: it existed only to beat the other
    // dispatch pipeline's select tool to the press.
    expect(result.current.bindings?.some((b) => b.spec.kind === 'pointerDown')).toBe(false);
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
    run(result.current, depsHitting('r1'), { press: { x: 5, y: 5 } });
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
    run(result.current, deps, { press: { x: 10, y: 10 }, world: { x: 13, y: 13 } });
    expect(seen).toEqual([{ x: 10, y: 10 }]);
  });

  it('colorOf returning null forwards null to onPick', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => null }),
    );
    run(result.current, depsHitting('r1'), { press: { x: 0, y: 0 } });
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('click on empty does NOT call onPick', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => '#fff' }),
    );
    run(result.current, depsHitting(null), { press: { x: 0, y: 0 } });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('no nodeAtPoint dep registered → no pick, no throw', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => '#fff' }),
    );
    run(result.current, {} as ActionDeps, { press: { x: 0, y: 0 } });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('takes the hotkey its caller names', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null, hotkey: 'alt' }),
    );
    expect((result.current.def as any)?.hotkey).toBe('alt');
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
    run(result.current, depsHitting('r1'), { press: { x: 0, y: 0 } });
    expect(onPick1).not.toHaveBeenCalled();
    expect(onPick2).toHaveBeenCalledWith('#222');
  });

  it('picks through the committed callbacks, not an abandoned render\'s', () => {
    const committed = vi.fn();
    const abandoned = vi.fn();
    let tool = null as Tool | null;
    function Probe({ onPick }: { onPick: (c: string | null) => void }) {
      tool = useEyedropperTool({ onPick, colorOf: () => '#abc' });
      return null;
    }
    renderThenAbandon(committed, abandoned, (onPick) => createElement(Probe, { onPick }));
    run(tool!, depsHitting('r1'), { press: { x: 1, y: 1 } });
    expect(abandoned).not.toHaveBeenCalled();
    expect(committed).toHaveBeenCalledExactlyOnceWith('#abc');
  });

  describe('sampling pixels, with no colorOf', () => {
    const view = { x: 10, y: 20, scale: { x: 2, y: 2 } };
    const pixelDeps = (colorAt: (p: { x: number; y: number }) => string | null | Promise<string | null>) =>
      ({ colorAt, view: { get: () => view } }) as unknown as ActionDeps;

    it('picks the color colorAt reports at the press, in screen px', () => {
      const onPick = vi.fn();
      const colorAt = vi.fn(() => '#123456');
      const { result } = renderHook(() => useEyedropperTool({ onPick }));
      run(result.current, pixelDeps(colorAt), { press: { x: 15, y: 25 }, world: { x: 40, y: 40 } });
      // World (15, 25) through a view at (10, 20) scale 2: screen (10, 10).
      expect(colorAt).toHaveBeenCalledExactlyOnceWith({ x: 10, y: 10 });
      expect(onPick).toHaveBeenCalledExactlyOnceWith('#123456');
    });

    it('picks nothing over nothing drawn, and nothing without a colorAt dep', () => {
      const onPick = vi.fn();
      const { result } = renderHook(() => useEyedropperTool({ onPick }));
      run(result.current, pixelDeps(() => null), { press: { x: 0, y: 0 } });
      run(result.current, {} as ActionDeps, { press: { x: 0, y: 0 } });
      expect(onPick).not.toHaveBeenCalled();
    });

    it('waits for a colorAt that answers later', async () => {
      const onPick = vi.fn();
      const { result } = renderHook(() => useEyedropperTool({ onPick }));
      run(result.current, pixelDeps(() => Promise.resolve('#abcdef')), { press: { x: 0, y: 0 } });
      expect(onPick).not.toHaveBeenCalled();
      await Promise.resolve();
      expect(onPick).toHaveBeenCalledExactlyOnceWith('#abcdef');
    });

    it('drops an answer that lands after a later press has answered', async () => {
      const onPick = vi.fn();
      const answers: ((hex: string | null) => void)[] = [];
      const colorAt = () => new Promise<string | null>((resolve) => { answers.push(resolve); });
      const { result } = renderHook(() => useEyedropperTool({ onPick }));
      run(result.current, pixelDeps(colorAt), { press: { x: 0, y: 0 } });
      run(result.current, pixelDeps(colorAt), { press: { x: 5, y: 5 } });
      answers[1]?.('#222222');
      await Promise.resolve();
      answers[0]?.('#111111');
      await Promise.resolve();
      expect(onPick.mock.calls).toEqual([['#222222']]);
    });

    it('takes the press as the screen point where no view is sourced, as on a 3D host', () => {
      const colorAt = vi.fn(() => '#000000');
      const { result } = renderHook(() => useEyedropperTool({ onPick: () => {} }));
      run(result.current, { colorAt } as unknown as ActionDeps, { press: { x: 7, y: 8 } });
      expect(colorAt).toHaveBeenCalledWith({ x: 7, y: 8 });
    });
  });
});
