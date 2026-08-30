/**
 * A derived edge has to follow the drag that moves its endpoint.
 *
 * The painted geometry comes from `scenePoseLookup`, which reads the scene's
 * ephemeral pose overrides. An action that keeps its in-flight poses only in
 * its own scratch is invisible to that lookup, so the endpoint ghosts at its
 * new position while the edge stays anchored to the old one and jumps on drop.
 */
import { describe, it, expect } from 'vitest';
import { moveAction } from './move';
import type { InvocationCtx, OngoingHandle, OngoingInvoker } from '../invoker';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { resolveDerivedPath, scenePoseLookup } from 'canvas/derivedPath';
import { linePath } from 'features/paths/builder';
import type { Path } from 'features/paths/types';

interface D { color?: string }
type L = 'main';
interface P { x: number; y: number; width: number; height: number }

function stubSelection(ids: string[]): SelectionApi {
  return { get: () => ids } as unknown as SelectionApi;
}

function ctx(
  scene: ReturnType<typeof createScene<D, L, P>>,
  ids: string[],
  drag?: { start: { x: number; y: number }; current: { x: number; y: number }; delta: { x: number; y: number } },
): InvocationCtx {
  return {
    world: drag ? { x: drag.current.x, y: drag.current.y } : { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: stubSelection(ids), scene },
    drag,
  } as unknown as InvocationCtx;
}

/** Two anchors and an edge deriving the line between them. */
function fixture() {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } });
  const b = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: { x: 200, y: 0, width: 10, height: 10 } });
  const edge = scene.add({
    kind: 'leaf',
    layer: 'main',
    data: {},
    pose: { x: 0, y: 0, width: 0, height: 0 },
    dependsOn: [a, b],
    derivePath: (_n, deps): Path | null => {
      const [from, to] = deps as readonly (P | undefined)[];
      if (!from || !to) return null;
      return linePath({ x: from.x, y: from.y }, { x: to.x, y: to.y });
    },
  });
  return { scene, a: a as string, b: b as string, edge: edge as NodeId };
}

/** The path the renderer would paint for the edge right now. */
function paintedEdge(scene: ReturnType<typeof createScene<D, L, P>>, edge: NodeId) {
  return resolveDerivedPath(scene.get(edge)!, scenePoseLookup(scene));
}

const DRAG = { start: { x: 5, y: 5 }, current: { x: 5, y: 105 }, delta: { x: 0, y: 100 } };

describe('moveAction — a derived edge follows the drag', () => {
  it('reaches the dragged endpoint mid-gesture, before any commit', () => {
    const { scene, a, edge } = fixture();
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [a]), {}) as OngoingHandle;

    handle.onMove!(ctx(scene, [a], DRAG));

    expect(paintedEdge(scene, edge)).toEqual(linePath({ x: 0, y: 100 }, { x: 200, y: 0 }));
  });

  it('leaves the document pose alone while the gesture is in flight', () => {
    // The whole point of the override channel: no history entry per frame.
    const { scene, a } = fixture();
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [a]), {}) as OngoingHandle;

    handle.onMove!(ctx(scene, [a], DRAG));

    expect(scene.get(asNodeId(a))!.pose).toMatchObject({ x: 0, y: 0 });
  });

  it('snaps the edge back when the gesture cancels', () => {
    const { scene, a, edge } = fixture();
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [a]), {}) as OngoingHandle;
    handle.onMove!(ctx(scene, [a], DRAG));

    handle.onEnd!(ctx(scene, [a], DRAG), 'cancel');

    expect(paintedEdge(scene, edge)).toEqual(linePath({ x: 0, y: 0 }, { x: 200, y: 0 }));
    expect(scene.overrides.ids()).toEqual([]);
  });

  it('holds the dragged geometry after commit, with no override left behind', () => {
    const { scene, a, edge } = fixture();
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(scene, [a]), {}) as OngoingHandle;
    handle.onMove!(ctx(scene, [a], DRAG));

    handle.onEnd!(ctx(scene, [a], DRAG), 'commit');

    expect(paintedEdge(scene, edge)).toEqual(linePath({ x: 0, y: 100 }, { x: 200, y: 0 }));
    expect(scene.overrides.ids()).toEqual([]);
  });
});
