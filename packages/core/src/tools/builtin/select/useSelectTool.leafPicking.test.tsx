/**
 * Coverage for `leafPicking: 'silhouette'` — the option that narrows the
 * default `pickEvery` from a leaf's pose rect to the shape its painter draws.
 *
 * Same harness shape as the clip-aware sibling: press a world point through
 * `select.pick` (the action the dispatcher's pointerdown routes to) and assert
 * what ends up selected. Driving a real `<Canvas>` would not work here — jsdom
 * gives the canvas no layout, so `clientToWorld` never runs and every press
 * lands at world (0,0).
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { useScene } from 'core/scene/useScene';
import type { UseSceneOptions } from 'core/scene/types';
import { useSelection } from 'core/selection/useSelection';
import { useSelectTool, type UseSelectToolOptions } from './useSelectTool';
import { asNodeId } from 'core/scene/types';
import type { Action } from '../../../interactions/actions/registry';
import type { ActionDeps } from '../../../interactions/actions/invoker';

interface Item { shape?: string; fill?: string; color?: string }
type Pose = { x: number; y: number; width: number; height: number };

function harness(
  initial: UseSceneOptions<Item, 'default', Pose>['initial'],
  options: UseSelectToolOptions<Pose>,
) {
  const { result } = renderHook(() => {
    const scene = useScene<Item, 'default', Pose>({
      systemLayers: [{ id: 'default' }],
      initial,
    });
    const sel = useSelection({ mode: 'single' });
    const adapter = sceneToAdapter(scene, { selection: sel });
    return { tool: useSelectTool(adapter as never, options as never), sel };
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

// An ellipse inscribed in a 100×100 pose. (2, 2) is inside the pose rect and
// comfortably outside the ellipse; (50, 50) is inside both.
const ELLIPSE = [{
  id: asNodeId('e'),
  kind: 'leaf' as const,
  layer: 'default' as const,
  pose: { x: 0, y: 0, width: 100, height: 100 },
  data: { shape: 'ellipse', fill: '#000' },
}];

describe('useSelectTool leafPicking', () => {
  it("defaults to 'aabb' — the pose corner selects the ellipse", () => {
    const h = harness(ELLIPSE, {});
    h.press(2, 2);
    expect(h.selection()).toEqual(['e']);
  });

  it("'silhouette' rejects a press inside the pose but outside the shape", () => {
    const h = harness(ELLIPSE, { leafPicking: 'silhouette' });
    h.press(2, 2);
    expect(h.selection()).toEqual([]);
  });

  it("'silhouette' still picks a press on the shape", () => {
    const h = harness(ELLIPSE, { leafPicking: 'silhouette' });
    h.press(50, 50);
    expect(h.selection()).toEqual(['e']);
  });

  it("'silhouette' leaves painters without a silhouette alone", () => {
    // `kit:rect-fallback` has no `silhouette`, so it keeps the AABB answer.
    // The refinement can only ever tighten a pick, never make a node
    // unreachable.
    const h = harness([{
      id: asNodeId('r'),
      kind: 'leaf' as const,
      layer: 'default' as const,
      pose: { x: 0, y: 0, width: 100, height: 100 },
      data: { color: '#abc' },
    }], { leafPicking: 'silhouette' });
    h.press(2, 2);
    expect(h.selection()).toEqual(['r']);
  });

  it("'silhouette' lets a press fall through to what is underneath", () => {
    // The reason the option exists: the top node's bounding box covers the
    // lower node, but its drawn shape does not.
    const h = harness([
      {
        id: asNodeId('under'),
        kind: 'leaf' as const,
        layer: 'default' as const,
        pose: { x: 0, y: 0, width: 20, height: 20 },
        data: { color: '#abc' },
      },
      ...ELLIPSE,
    ], { leafPicking: 'silhouette' });
    h.press(2, 2);
    expect(h.selection()).toEqual(['under']);
  });
});
