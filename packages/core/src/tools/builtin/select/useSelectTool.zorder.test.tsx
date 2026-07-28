/**
 * z-order regression test for `useSelectTool`'s default `pickEvery`.
 *
 * Drives a press onto overlapping rects through `select.pick` — the action the
 * `pointerDown` binding routes to — and asserts the topmost (last in array
 * order = top in paint order) is selected.
 */
import { describe, it, expect } from 'vitest';
import { useRef, useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { arrayAdapter } from 'core/adapters/arrayAdapter';
import { useSelection } from 'core/selection/useSelection';
import { useSelectTool } from './useSelectTool';
import { asNodeId } from 'core/scene/types';
import type { Action } from '../../../interactions/actions/registry';
import type { ActionDeps } from '../../../interactions/actions/invoker';

interface Rect { id: string; x: number; y: number; width: number; height: number }
interface Pose { x: number; y: number; width: number; height: number }

/** Mounts the select tool over an array-adapter scene of the given rects, and
 *  returns a `press(x, y)` that fires `select.pick` the way the dispatcher's
 *  eager pointerdown does. No `pickEvery` is supplied — the point is to
 *  exercise the default (rect AABB scan over `adapter.getNodes()`). */
function harness(initial: Rect[]) {
  const { result } = renderHook(() => {
    const [rects, setRects] = useState<Rect[]>(initial);
    const rectsRef = useRef(rects);
    rectsRef.current = rects;
    const sel = useSelection({ mode: 'single' });

    const base = arrayAdapter<Rect, Pose>({
      ref: rectsRef,
      setItems: setRects,
      toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
    });
    const adapter = { ...base, ...sel.adapterMethods };
    return { tool: useSelectTool(adapter, {}), sel };
  });

  return {
    press(x: number, y: number) {
      const tool = result.current.tool as { actions?: readonly Action[] };
      const invoker = tool.actions?.find((a) => a.id === 'select.pick')?.invoker;
      if (invoker?.timing !== 'immediate') throw new Error('select.pick missing');
      act(() => {
        invoker.run({ selection: result.current.sel } as unknown as ActionDeps, {
          worldX: x,
          worldY: y,
          mods: { alt: false, ctrl: false, meta: false, shift: false },
        });
      });
    },
    selection: () => result.current.sel.current,
  };
}

describe('useSelectTool — default pickEvery z-order', () => {
  it('press on overlapping rects selects the topmost (last in array)', () => {
    // A and B fully overlap; B added second → painted on top.
    const h = harness([
      { id: 'A', x: 0, y: 0, width: 100, height: 100 },
      { id: 'B', x: 0, y: 0, width: 100, height: 100 },
    ]);
    h.press(50, 50);
    expect(h.selection()).toEqual([asNodeId('B')]);
  });

  it('three-rect stack: deepest in array wins on press', () => {
    const h = harness([
      { id: 'A', x: 0, y: 0, width: 100, height: 100 },
      { id: 'B', x: 0, y: 0, width: 100, height: 100 },
      { id: 'C', x: 0, y: 0, width: 100, height: 100 },
    ]);
    h.press(50, 50);
    expect(h.selection()).toEqual([asNodeId('C')]);
  });
});
