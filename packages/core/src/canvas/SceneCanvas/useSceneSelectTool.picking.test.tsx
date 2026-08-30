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
import { renderHook, act } from '@testing-library/react';
import { useScene } from 'core/scene/useScene';
import type { UseSceneOptions } from 'core/scene/types';
import { useSelection } from 'core/selection/useSelection';
import { asNodeId } from 'core/scene/types';
import { useSceneSelectTool } from './useSceneSelectTool';
import { rectPath, linePath } from 'features/paths/builder';

interface Item { shape?: string; fill?: string; color?: string; stroke?: unknown }
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

describe('useSceneSelectTool — hidden layers', () => {
  it('stops picking nodes on a layer the scene has hidden', () => {
    const { result } = renderHook(() => {
      const scene = useScene<Item, 'default' | 'bg', Pose>({
        systemLayers: [{ id: 'default' }, { id: 'bg' }],
        initial: [{
          id: asNodeId('hidden-node'),
          kind: 'leaf',
          layer: 'bg',
          pose: { x: 0, y: 0, width: 50, height: 50 },
          data: { color: '#abc' },
        }],
      });
      const selection = useSelection({ mode: 'single' });
      return { scene, tool: useSceneSelectTool({ scene, selection }) };
    });

    expect(result.current.tool.pickEvery(10, 10)).toEqual(['hidden-node']);
    act(() => { result.current.scene.setLayerVisible('bg', false); });
    expect(result.current.tool.pickEvery(10, 10)).toEqual([]);
  });
});

describe('useSceneSelectTool — geometry.picking', () => {
  it('defaults to the painted shape: the ellipse does not claim its corner', () => {
    // (2, 2) is inside the ellipse's 100×100 pose box but outside the ellipse.
    // The default used to hand it to the ellipse, burying `under`.
    const pick = harness();
    expect(pick(2, 2)).toEqual(['under']);
  });

  it("'pose' opts back down to the bounding box", () => {
    const pick = harness('pose');
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

describe('useSceneSelectTool — pose overrides', () => {
  // An override replaces the pose everywhere the render and hit-test paths
  // read one (`core/scene/types.ts`). The ForceGraph demo paints every node at
  // its simulated position, so picking the document pose picks empty space.
  function overrideHarness() {
    const { result } = renderHook(() => {
      const scene = useScene<Item, 'default', Pose>({
        systemLayers: [{ id: 'default' }],
        initial: (NODES ?? []).slice(0, 1),
      });
      const selection = useSelection({ mode: 'single' });
      return { scene, tool: useSceneSelectTool({ scene, selection }) };
    });
    act(() => {
      result.current.scene.overrides.set(asNodeId('under'), {
        pose: { x: 200, y: 200, width: 20, height: 20 },
      });
    });
    return result;
  }

  it('picks where the override draws the node', () => {
    const result = overrideHarness();
    expect(result.current.tool.pickEvery(205, 205)).toEqual(['under']);
  });

  it('stops picking where the document pose used to be', () => {
    const result = overrideHarness();
    expect(result.current.tool.pickEvery(5, 5)).toEqual([]);
  });

  it('reports bounds at the override, so chrome follows the paint', () => {
    const result = overrideHarness();
    expect(result.current.tool.boundsOf('under')).toMatchObject({ x: 200, y: 200 });
  });
});

describe('useSceneSelectTool — ancestor clips', () => {
  // `useSelectTool`'s own walk has answered this since clipping shipped
  // (see useSelectTool.clipping.test.tsx); the walk SceneCanvas installs
  // instead of it had no clip term, so a child clipped out of view was
  // invisible and still clickable.
  function clipHarness(clip: [number, number, number, number], leaf: Pose) {
    const { result } = renderHook(() => {
      const scene = useScene<Item, 'default', Pose>({
        systemLayers: [{ id: 'default' }],
        initial: [
          {
            id: asNodeId('bed'),
            kind: 'container',
            layer: 'default',
            pose: { x: -50, y: -50, width: 150, height: 150 },
            data: {},
            clipFromPose: () => rectPath(...clip),
          },
          {
            id: asNodeId('inner'),
            parent: asNodeId('bed'),
            kind: 'leaf',
            layer: 'default',
            pose: leaf,
            data: {},
          },
        ],
      });
      const selection = useSelection({ mode: 'single' });
      return useSceneSelectTool({ scene, selection });
    });
    return result;
  }

  it('does not pick a leaf the container clips away', () => {
    // The point is inside the leaf's own box and outside the clip.
    const r = clipHarness([50, 50, 50, 50], { x: -5, y: -5, width: 20, height: 20 });
    expect(r.current.pickEvery(0, 0)).not.toContain('inner');
  });

  it('still picks a leaf inside the clip', () => {
    // Paired with the case above: the clip is smaller than the container's
    // box, so passing documents a clip pass rather than a bare AABB pass.
    const r = clipHarness([-20, -20, 40, 40], { x: -5, y: -5, width: 10, height: 10 });
    expect(r.current.pickEvery(0, 0)).toContain('inner');
  });
});

describe('useSceneSelectTool — stroke reach', () => {
  // `shapeCoversPoint` grants a grab out to the stroke's outer reach, and the
  // AABB pre-filter that runs first grew only by `tolerance` — so half a thick
  // outer stroke's ink was unclickable, and the refinement never saw the point.
  function strokedHarness(scale = 1) {
    const { result } = renderHook(() => {
      const scene = useScene<Item, 'default', Pose>({
        systemLayers: [{ id: 'default' }],
        initial: [{
          id: asNodeId('boxed'),
          kind: 'leaf',
          layer: 'default',
          pose: { x: 0, y: 0, width: 100, height: 100 },
          data: { shape: 'rect', stroke: { width: 20, align: 'outer', paint: '#000' } },
        }],
      });
      const selection = useSelection({ mode: 'single' });
      return useSceneSelectTool({
        scene,
        selection,
        getView: () => ({ x: 0, y: 0, scale: { x: scale, y: scale } }),
      });
    });
    return result;
  }

  it('picks a point inside a thick outer stroke, outside the pose box', () => {
    // The stroke reaches 20 world units past the edge; -10 is in its ink.
    expect(strokedHarness().current.pickEvery(-10, 50)).toContain('boxed');
  });

  it('still rejects a point past the stroke', () => {
    expect(strokedHarness().current.pickEvery(-40, 50)).not.toContain('boxed');
  });
});

describe('useSceneSelectTool — derived nodes', () => {
  /** An edge deriving a line between two anchors 200 apart. Its own pose is a
   *  zero-sized placeholder at the origin, so nothing about where it paints
   *  can be read off the pose — the pre-filter has to consult the derived
   *  path or it rejects the edge before the shape test ever runs. */
  function derivedHarness() {
    const { result } = renderHook(() => {
      const scene = useScene<Item, 'default', Pose>({
        systemLayers: [{ id: 'default' }],
        initial: [
          {
            id: asNodeId('a'), kind: 'leaf', layer: 'default',
            pose: { x: 0, y: 0, width: 10, height: 10 }, data: {},
          },
          {
            id: asNodeId('b'), kind: 'leaf', layer: 'default',
            pose: { x: 200, y: 0, width: 10, height: 10 }, data: {},
          },
          {
            id: asNodeId('edge'), kind: 'leaf', layer: 'default',
            pose: { x: 0, y: 0, width: 0, height: 0 },
            data: { stroke: { width: 2, paint: '#000' } },
            dependsOn: [asNodeId('a'), asNodeId('b')],
            derivePath: (_n: unknown, deps: readonly (Pose | undefined)[]) => {
              const [from, to] = deps;
              if (!from || !to) return null;
              return linePath({ x: from.x, y: from.y }, { x: to.x, y: to.y });
            },
          },
        ] as UseSceneOptions<Item, 'default', Pose>['initial'],
      });
      const selection = useSelection({ mode: 'single' });
      return { scene, tool: useSceneSelectTool({ scene, selection }) };
    });
    return result;
  }

  it('picks a derived edge along the line it paints', () => {
    expect(derivedHarness().current.tool.pickEvery(100, 0)).toContain('edge');
  });

  it('does not pick a derived edge away from the line', () => {
    expect(derivedHarness().current.tool.pickEvery(100, 60)).not.toContain('edge');
  });

  it('follows its dependencies when one of them moves', () => {
    const result = derivedHarness();
    act(() => {
      result.current.scene.setPose(asNodeId('b'), { x: 0, y: 200, width: 10, height: 10 });
    });
    expect(result.current.tool.pickEvery(100, 0)).not.toContain('edge');
    expect(result.current.tool.pickEvery(0, 100)).toContain('edge');
  });
});
