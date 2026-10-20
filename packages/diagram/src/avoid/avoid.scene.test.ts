import { describe, expect, it } from 'vitest';
import { createScene, createTransformOp, derivedDepOf, documentPose, type InvocationCtx, type RectPose, type Scene } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import { edgeLabelSpec } from '../edgeLabel';
import type { DiagramEdge } from '../edgeTrait';
import { commitRouteToScene } from '../waypointAction';
import { pinSegment } from '../waypoints';
import { waypointFollower } from '../waypointFollower';
import { entersBox } from './avoidFixture';
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
    const preview = routing.follower.preview(frame, new Map());
    expect(preview.map((p) => p.id)).toEqual(['ab']);
    const shown = (preview[0]!.data as { diagram: DiagramEdge }).diagram.route!;
    expect(shown.length).toBeGreaterThan(0);
    expect(routeOf(scene)).toEqual([]);
  });

  it('previews the waypoints the waypoint follower carried, and carries none of its own', () => {
    const { scene, routing } = load({ waypoints: [{ x: 200, y: 30 }] });
    const frame = new Map([['a', { x: 0, y: 100, width: 100, height: 60 }], ['b', { x: 400, y: 100, width: 100, height: 60 }]]);
    const waypointsOf = (data: unknown) => (data as { diagram: DiagramEdge }).diagram.waypoints;

    // Alone, as a commit without the waypoint follower leaves them: where they were.
    const alone = routing.follower.preview(frame, new Map()).find((p) => p.id === 'ab')!;
    expect(waypointsOf(alone.data)).toEqual([{ x: 200, y: 30 }]);

    // After the waypoint follower, as the transform composes them: where it carried them, and routed through.
    const carried = waypointFollower(scene).preview(frame, new Map());
    const seen = new Map<string, unknown>([...frame, ...carried.map((c) => [c.id, c.pose] as const)]);
    const data = new Map(carried.map((c) => [c.id, c.data]));
    const shown = routing.follower.preview(seen, data).find((p) => p.id === 'ab')!;
    expect(waypointsOf(shown.data)).toEqual(waypointsOf(data.get('ab')));
    expect(waypointsOf(shown.data)).toEqual([{ x: 200, y: 130 }]);
    const route = (shown.data as { diagram: DiagramEdge }).diagram.route!;
    expect(route).toContainEqual({ x: 200, y: 130 });
  });

  it('reroutes around another connector’s label once it is added, in the add’s own entry', () => {
    const { scene } = load({ route: [] });
    scene.add(box('up', 150, -200) as never);
    scene.add(box('down', 150, 200) as never);
    scene.add(connector('cross', 'up', 'down', { route: [], from: { port: 's' }, to: { port: 'n' } }) as never);
    expect(routeOf(scene)).toEqual([]);
    const depth = scene.historyEntries().length;
    scene.add(edgeLabelSpec('cross', 'a long note', { layer: 'main' }) as never);
    expect(scene.historyEntries().length).toBe(depth + 1);
    const label = documentPose(scene, scene.get('cross/label' as never)!);
    const points = drawn(scene);
    expect(points.length).toBeGreaterThan(2);
    points.slice(1).forEach((p, i) => expect(entersBox(points[i]!, p, label)).toBe(false));
    scene.undo();
    expect(routeOf(scene)).toEqual([]);
  });
});
