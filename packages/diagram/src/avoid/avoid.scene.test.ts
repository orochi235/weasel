import { describe, expect, it } from 'vitest';
import { createScene, createTransformOp, derivedDepOf, type InvocationCtx, type RectPose, type Scene } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import type { DiagramEdge } from '../edgeTrait';
import { commitRouteToScene } from '../waypointAction';
import { pinSegment } from '../waypoints';
import { installAvoidRouting } from './install';

type AvoidScene = Scene<unknown, 'main', RectPose>;

const box = (id: string, x: number, y: number, width = 100, height = 60) =>
  ({ id: id as never, kind: 'leaf' as const, layer: 'main' as const, pose: { x, y, width, height }, data: { diagram: {} } });

const connector = (id: string, from: string, to: string, extra: Partial<DiagramEdge> = {}) => ({
  id: id as never,
  kind: 'leaf' as const,
  layer: 'main' as const,
  pose: { x: 0, y: 0, width: 0, height: 0 },
  data: { diagram: { from: {}, to: {}, router: 'avoid', ...extra } },
  dependsOn: [from as never, to as never],
  derivePath: EDGE_DERIVE_PATH,
});

function load(extra: Partial<DiagramEdge> = {}) {
  const scene: AvoidScene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withDiagramRegistry(),
    initial: [box('a', 0, 0), box('b', 400, 0), connector('ab', 'a', 'b', extra)] as never,
  });
  const routing = installAvoidRouting(scene);
  const adapter = { setPose: (id: string, pose: RectPose) => scene.setPose(id as never, pose) };
  return { scene, routing, adapter };
}

const routeOf = (scene: AvoidScene, id = 'ab') => (scene.get(id as never)!.data as { diagram: DiagramEdge }).diagram.route;

/** The points the edge draws through, read off its derived path. */
function drawn(scene: AvoidScene, id = 'ab'): Vec2[] {
  const path = derivedDepOf(scene, id as never)?.path;
  const coords = [...((path as { coords?: Float32Array } | null | undefined)?.coords ?? [])];
  return coords.flatMap((v, i) => (i % 2 === 0 ? [{ x: v, y: coords[i + 1]! }] : []));
}

describe('avoid routing in a scene', () => {
  it('leaves the routes a scene holds when installed', () => {
    const { scene } = load({ route: [{ x: 250, y: 30 }] });
    expect(routeOf(scene)).toEqual([{ x: 250, y: 30 }]);
  });

  it('reroutes when a shape is inserted onto a route, in the insert’s entry, and undo restores the route', () => {
    const { scene } = load({ route: [] });
    const before = routeOf(scene);
    const depth = scene.historyEntries().length;
    scene.add(box('wall', 200, -100, 60, 260) as never);
    const after = routeOf(scene)!;
    expect(after.length).toBeGreaterThan(0);
    expect(scene.historyEntries().length).toBe(depth + 1);
    scene.undo();
    expect(routeOf(scene)).toEqual(before);
    expect(scene.get('wall' as never)).toBeUndefined();
  });

  it('reroutes when a shape is moved onto the route, in the move’s own entry', () => {
    const { scene, adapter } = load();
    scene.add(box('wall', 200, 300, 60, 260) as never);
    const before = routeOf(scene);
    const depth = scene.historyEntries().length;
    scene.applyBatch([createTransformOp({ id: 'wall', from: scene.get('wall' as never)!.pose, to: { x: 200, y: -100, width: 60, height: 260 } })], 'Move', adapter);
    expect(routeOf(scene)).not.toEqual(before);
    expect(scene.historyEntries().length).toBe(depth + 1);
    scene.undo();
    expect(routeOf(scene)).toEqual(before);
  });

  it('draws the stored route, and falls back to orthogonal once an end moves without rerouting', () => {
    const { scene, routing } = load();
    scene.add(box('wall', 200, -100, 60, 260) as never);
    const route = routeOf(scene)!;
    expect(drawn(scene).slice(1, -1)).toEqual(route);
    routing.dispose();
    scene.setPose('b' as never, { x: 600, y: 200, width: 100, height: 60 });
    const points = drawn(scene);
    expect(points.slice(1, -1)).not.toEqual(route);
    expect(points.every((p, i) => i === 0 || p.x === points[i - 1]!.x || p.y === points[i - 1]!.y)).toBe(true);
  });

  it('routes the rest around a pinned segment, in the pin’s own entry', () => {
    const { scene } = load();
    scene.add(box('wall', 200, -100, 60, 260) as never);
    const before = drawn(scene);
    const run = before.findIndex((p, i) => i > 0 && p.y === before[i - 1]!.y && p.y < 0);
    const pinned = pinSegment(before, [before[0]!, before[before.length - 1]!], run - 1, -40);
    const depth = scene.historyEntries().length;
    commitRouteToScene({ edgeId: 'ab', waypoints: pinned }, { deps: { scene } } as unknown as InvocationCtx);
    expect(scene.historyEntries().length).toBe(depth + 1);
    const after = drawn(scene);
    for (const p of pinned) expect(after).toContainEqual(p);
    expect(routeOf(scene)).toEqual(after.slice(1, -1));
  });

  it('previews a drag frame without writing the scene', () => {
    const { scene, routing } = load();
    scene.add(box('wall', 200, 300, 60, 260) as never);
    const frame = new Map([['wall', { x: 200, y: -100, width: 60, height: 260 }]]);
    const preview = routing.follower.preview(frame);
    expect(preview.map((p) => p.id)).toEqual(['ab']);
    const shown = (preview[0]!.data as { diagram: DiagramEdge }).diagram.route!;
    expect(shown.length).toBeGreaterThan(0);
    expect(routeOf(scene)).toEqual([]);
  });
});
