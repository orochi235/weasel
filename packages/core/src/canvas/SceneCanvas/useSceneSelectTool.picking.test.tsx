/**
 * Coverage for `geometry.picking` on the `<SceneCanvas>` path.
 *
 * `useSceneSelectTool` always supplies its own `pickEvery` to `useSelectTool`,
 * so `UseSelectToolOptions.leafPicking` never reaches a `<SceneCanvas>`
 * consumer — this is the wiring that does. Tested through the hook's returned
 * `pickEvery`, which is exactly what `<Canvas>` and the `nodeAtPoint` dep are
 * handed.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScene } from 'core/scene/useScene';
import type { UseSceneOptions } from 'core/scene/types';
import { useSelection } from 'core/selection/useSelection';
import { asNodeId } from 'core/scene/types';
import { useSceneSelectTool } from './useSceneSelectTool';

interface Item { shape?: string; fill?: string; color?: string }
type Pose = { x: number; y: number; width: number; height: number };

const NODES: UseSceneOptions<Item, 'default', Pose>['initial'] = [
  // Bottom: a small plain rect in the top-left corner.
  {
    id: asNodeId('under'),
    kind: 'leaf',
    layer: 'default',
    pose: { x: 0, y: 0, width: 20, height: 20 },
    data: { color: '#abc' },
  },
  // Top: an ellipse inscribed in a 100×100 pose. Its bounding box covers
  // `under`; the shape it draws does not.
  {
    id: asNodeId('ellipse'),
    kind: 'leaf',
    layer: 'default',
    pose: { x: 0, y: 0, width: 100, height: 100 },
    data: { shape: 'ellipse', fill: '#000' },
  },
];

function harness(picking?: 'pose' | 'shape') {
  const { result } = renderHook(() => {
    const scene = useScene<Item, 'default', Pose>({
      systemLayers: [{ id: 'default' }],
      initial: NODES,
    });
    const selection = useSelection({ mode: 'single' });
    return useSceneSelectTool({
      scene,
      selection,
      ...(picking ? { geometry: { picking } } : {}),
    });
  });
  return (x: number, y: number) => result.current.pickEvery(x, y);
}

describe('useSceneSelectTool — geometry.picking', () => {
  it('defaults to the pose rect: the ellipse claims its whole bounding box', () => {
    const pick = harness();
    expect(pick(2, 2)).toEqual(['under', 'ellipse']);
  });

  it("'shape' drops the ellipse where it does not paint", () => {
    const pick = harness('shape');
    expect(pick(2, 2)).toEqual(['under']);
  });

  it("'shape' keeps the ellipse where it does paint", () => {
    const pick = harness('shape');
    expect(pick(50, 50)).toContain('ellipse');
  });

  it("'shape' does not disturb the back-to-front order it returns", () => {
    // `useSelectTool` reads the last element as topmost, so the filter must
    // preserve `renderOrder()` rather than rebuild the list.
    const pick = harness('shape');
    const ids = pick(15, 15); // inside `under` AND inside the ellipse
    expect(ids).toEqual(['under', 'ellipse']);
  });
});
