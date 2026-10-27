/**
 * z-order regression test for `useSelectTool`'s default `pickEvery`.
 *
 * Drives a press onto overlapping rects through `select.pick` — the action the
 * `pointerDown` binding routes to — and asserts the topmost (last in array
 * order = top in paint order) is selected.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelection } from 'core/selection/useSelection';
import { useSelectTool } from './useSelectTool';
import { rectListAdapter } from './testing/rectListAdapter';
import { asNodeId } from 'core/scene/types';
import type { Action } from '@weasel-js/routing';
import type { ActionDeps } from '@weasel-js/routing';

interface Rect { id: string; x: number; y: number; width: number; height: number }

/** Mounts the select tool over a bare adapter holding the given rects, and
 *  returns a `press(x, y)` that fires `select.pick` the way the dispatcher's
 *  eager pointerdown does. No `pickEvery` is supplied — the point is to
 *  exercise the default (rect AABB walk of the adapter's tree). */
function harness(initial: Rect[]) {
  const { result } = renderHook(() => {
    const sel = useSelection({ mode: 'single' });
    const adapter = { ...rectListAdapter(initial), ...sel.adapterMethods };
    return { tool: useSelectTool(adapter, {}), sel };
  });

  return {
    press(x: number, y: number) {
      const tool = result.current.tool as { actions?: readonly Action[] };
      const invoker = tool.actions?.find((a) => a.id === 'select.pick')?.invoker;
      if (invoker?.timing !== 'immediate') throw new Error('select.pick missing');
      act(() => {
        invoker.run({ selection: result.current.sel } as unknown as ActionDeps, {
          world: { x, y },
          mods: { alt: false, ctrl: false, meta: false, shift: false },
        });
      });
    },
    selection: () => result.current.sel.current,
  };
}

describe('useSelectTool — default pickEvery z-order', () => {
  it('press on a stack of overlapping rects selects the topmost (last in array)', () => {
    const h = harness([
      { id: 'A', x: 0, y: 0, width: 100, height: 100 },
      { id: 'B', x: 0, y: 0, width: 100, height: 100 },
      { id: 'C', x: 0, y: 0, width: 100, height: 100 },
    ]);
    h.press(50, 50);
    expect(h.selection()).toEqual([asNodeId('C')]);
  });
});
