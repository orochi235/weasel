/**
 * A consumer with an adapter and no `Scene` can still tell the default pick
 * what its view paints: a node faded to nothing, or on a layer the view does
 * not draw, is not under the pointer.
 */
import { describe, it, expect } from 'vitest';
import { useRef, useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { arrayAdapter } from 'core/adapters/arrayAdapter';
import { useSelection } from 'core/selection/useSelection';
import { useSelectTool, type UseSelectToolOptions } from './useSelectTool';
import { asNodeId } from 'core/scene/types';
import type { Action } from '@weasel-js/routing';
import type { ActionDeps } from '@weasel-js/routing';

interface Rect { id: string; layer: string; x: number; y: number; width: number; height: number }
interface Pose { x: number; y: number; width: number; height: number }

/** `under` and `over` overlap exactly; `over` paints on top. */
const RECTS: Rect[] = [
  { id: 'under', layer: 'base', x: 0, y: 0, width: 100, height: 100 },
  { id: 'over', layer: 'fx', x: 0, y: 0, width: 100, height: 100 },
];

function pressAt(options: UseSelectToolOptions<Pose>, x: number, y: number): readonly string[] {
  const { result } = renderHook(() => {
    const [rects, setRects] = useState<Rect[]>(RECTS);
    const ref = useRef(rects);
    ref.current = rects;
    const sel = useSelection({ mode: 'single' });
    const base = arrayAdapter<Rect, Pose>({
      ref,
      setItems: setRects,
      toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
    });
    return { tool: useSelectTool({ ...base, ...sel.adapterMethods }, options), sel };
  });
  const tool = result.current.tool as { actions?: readonly Action[] };
  const invoker = tool.actions?.find((a) => a.id === 'select.pick')?.invoker;
  if (invoker?.timing !== 'immediate') throw new Error('select.pick missing');
  act(() => {
    invoker.run({ selection: result.current.sel } as unknown as ActionDeps, {
      worldX: x, worldY: y, mods: { alt: false, ctrl: false, meta: false, shift: false },
    });
  });
  return result.current.sel.current;
}

describe('useSelectTool over a bare adapter — view gates', () => {
  it('picks the top node when no gate is given', () => {
    expect(pressAt({}, 50, 50)).toEqual([asNodeId('over')]);
  });

  it('passes over a node its view paints at alpha 0', () => {
    expect(pressAt({ alphaOf: (id) => (id === 'over' ? 0 : 1) }, 50, 50)).toEqual([asNodeId('under')]);
  });

  it('passes over a node on a layer its view does not paint', () => {
    expect(pressAt({ layerIsPainted: (l) => l !== 'fx' }, 50, 50)).toEqual([asNodeId('under')]);
  });
});
