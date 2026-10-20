import { describe, expect, it } from 'vitest';
import {
  createScene, moveAction, type ActionDeps, type ImmediateInvoker, type InvocationCtx, type OngoingHandle, type OngoingInvoker, type RectPose,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from './edge';
import type { DiagramEdge } from './edgeTrait';
import { diagramScene, edgeIdOf, type DiagramData } from './fromData';
import { buildGraph } from './graph';
import { layered } from './layered';
import { planOf } from './layout';
import { applyLayout } from './layoutAction';
import { sceneParticipants } from './portLayer';
import { routesOf } from './routeWrites';
import { createResetRouteAction } from './routeCommands';
import { commitRouteToScene } from './waypointAction';
import { waypointFollower } from './waypointFollower';

const edgeOf = (scene: { get(id: never): { data: unknown } | undefined }, id: string) =>
  (scene.get(id as never)!.data as { diagram: DiagramEdge }).diagram;

describe('a route edit in a scene', () => {
  const DATA: DiagramData = {
    nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }, { id: 'c', lines: ['c'] }],
    edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }, { from: 'c', to: 'b' }],
  };
  const AB = edgeIdOf({ from: 'a', to: 'b' });

  function load() {
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }], initial: diagramScene(DATA) as never, registry: withDiagramRegistry(),
    });
    const relayout = () => {
      const graph = buildGraph<RectPose>(sceneParticipants(scene as never));
      const plan = planOf(layered, graph);
      applyLayout(scene, plan.moves, { routes: routesOf(graph, plan) });
    };
    return { scene, relayout };
  }

  it('is one undo entry, and owns the route from then on', () => {
    const { scene } = load();
    const before = edgeOf(scene, AB);
    commitRouteToScene({ edgeId: AB, waypoints: [{ x: 500, y: 40 }] }, { deps: { scene } } as unknown as InvocationCtx);
    expect(edgeOf(scene, AB).waypoints).toEqual([{ x: 500, y: 40 }]);
    expect(edgeOf(scene, AB).laidOut).toBeUndefined();
    scene.undo();
    expect(edgeOf(scene, AB)).toEqual(before);
  });

  it('is cleared from every selected edge by Reset route, in one undo entry', () => {
    const { scene } = load();
    const AC = edgeIdOf({ from: 'a', to: 'c' });
    const ctx = { deps: { scene } } as unknown as InvocationCtx;
    commitRouteToScene({ edgeId: AB, waypoints: [{ x: 500, y: 40 }] }, ctx);
    commitRouteToScene({ edgeId: AC, waypoints: [{ x: 500, y: 90 }] }, ctx);
    const reset = createResetRouteAction<RectPose>({
      participants: sceneParticipants(scene as never), selected: () => [AB, AC, 'a'],
    });
    expect(reset.enabled!({ scene } as never)).toBe(true);
    (reset.invoker as ImmediateInvoker).run({ scene } as never, undefined);
    expect(edgeOf(scene, AB).waypoints).toBeUndefined();
    expect(edgeOf(scene, AC).waypoints).toBeUndefined();
    expect(reset.enabled!({ scene } as never)).not.toBe(true);
    scene.undo();
    expect(edgeOf(scene, AB).waypoints).toEqual([{ x: 500, y: 40 }]);
    expect(edgeOf(scene, AC).waypoints).toEqual([{ x: 500, y: 90 }]);
  });

  it('survives a layout run afterward', () => {
    const { scene, relayout } = load();
    commitRouteToScene({ edgeId: AB, waypoints: [{ x: 500, y: 40 }] }, { deps: { scene } } as unknown as InvocationCtx);
    relayout();
    expect(edgeOf(scene, AB).waypoints).toEqual([{ x: 500, y: 40 }]);
  });
});

describe('waypointFollower', () => {
  type Scene = ReturnType<typeof twoShapes>['scene'];

  /** A and B side by side, and `ab` between them through (200, 100). */
  function twoShapes() {
    const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    for (const [id, x] of [['A', 0], ['B', 300]] as const) {
      scene.add({ id: id as never, kind: 'leaf', layer: 'main', pose: { x, y: 0, width: 100, height: 40 }, data: { diagram: {} } });
    }
    scene.add({
      id: 'ab' as never, kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { diagram: { from: {}, to: {}, waypoints: [{ x: 200, y: 100 }] } },
      dependsOn: ['A' as never, 'B' as never], derivePath: EDGE_DERIVE_PATH as never,
    });
    return { scene };
  }

  function drag(scene: Scene, ids: string[], during?: (handle: OngoingHandle) => void): void {
    const deps = {
      selection: { get: () => ids, adapterMethods: undefined }, scene, transformFollowers: [waypointFollower(scene)],
    } as unknown as ActionDeps;
    const at = (moving: boolean) => ({
      world: moving ? { x: 60, y: 25 } : { x: 50, y: 20 }, screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps,
      drag: moving ? { start: { x: 50, y: 20 }, current: { x: 60, y: 25 }, delta: { x: 10, y: 5 } } : undefined,
    }) as unknown as InvocationCtx;
    const handle = (moveAction.invoker as OngoingInvoker).start(at(false), undefined) as OngoingHandle;
    handle.onMove!(at(true));
    during?.(handle);
    handle.onEnd!(at(true), 'commit');
  }

  const waypoints = (scene: Scene): readonly Vec2[] | undefined => edgeOf(scene as never, 'ab').waypoints;

  it('carries the waypoints with a move of both ends, previewed and in the move\'s undo entry', () => {
    const { scene } = twoShapes();
    drag(scene, ['A', 'B'], (handle) => {
      expect([...handle.previewIds!()!]).toContain('ab');
      expect((handle.previewData!('ab') as { diagram: DiagramEdge }).diagram.waypoints).toEqual([{ x: 210, y: 105 }]);
    });
    expect(scene.get('A' as never)!.pose).toMatchObject({ x: 10, y: 5 });
    expect(waypoints(scene)).toEqual([{ x: 210, y: 105 }]);
    scene.undo();
    expect(scene.get('A' as never)!.pose).toMatchObject({ x: 0, y: 0 });
    expect(waypoints(scene)).toEqual([{ x: 200, y: 100 }]);
  });

  it('leaves them where they are when only one end moves', () => {
    const { scene } = twoShapes();
    drag(scene, ['A']);
    expect(scene.get('A' as never)!.pose).toMatchObject({ x: 10, y: 5 });
    expect(waypoints(scene)).toEqual([{ x: 200, y: 100 }]);
  });
});
