import { describe, it, expect } from 'vitest';
import { createScene, asNodeId, type DerivedDep, type RectPose } from '@weasel-js/core';
import {
  DIAGRAM_EDGE,
  bezier,
  diagramEdgeOf,
  edgeDerivePath,
  orthogonal,
  straight,
  withDiagramRegistry,
  type Router,
} from './edge';
import type { Port } from './types';

const port = (id: string, x: number, y: number, normal: Port['normal'] = null): Port =>
  ({ id, nodeId: 'n', point: { x, y }, normal });

const req = (from: Port, to: Port, waypoints: { x: number; y: number }[] = []) =>
  ({ from, to, waypoints });

describe('straight', () => {
  it('runs end to end', () => {
    expect(straight(req(port('a', 0, 0), port('b', 100, 50))))
      .toEqual([{ x: 0, y: 0 }, { x: 100, y: 50 }]);
  });

  it('passes through the waypoints in order', () => {
    expect(straight(req(port('a', 0, 0), port('b', 100, 0), [{ x: 40, y: 20 }])))
      .toEqual([{ x: 0, y: 0 }, { x: 40, y: 20 }, { x: 100, y: 0 }]);
  });
});

describe('orthogonal', () => {
  it('leaves along a horizontal normal before turning', () => {
    expect(orthogonal(req(port('a', 0, 0, { x: 1, y: 0 }), port('b', 100, 50))))
      .toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }]);
  });

  it('leaves along a vertical normal before turning', () => {
    expect(orthogonal(req(port('a', 0, 0, { x: 0, y: 1 }), port('b', 100, 50))))
      .toEqual([{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 100, y: 50 }]);
  });

  it('adds no elbow when the ends already share an axis', () => {
    expect(orthogonal(req(port('a', 0, 0, { x: 1, y: 0 }), port('b', 100, 0))))
      .toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  });

  it('turns through a waypoint rather than around it', () => {
    const pts = orthogonal(req(port('a', 0, 0, { x: 1, y: 0 }), port('b', 100, 100),
      [{ x: 50, y: 50 }]));
    expect(pts).toContainEqual({ x: 50, y: 50 });
    // Every leg is axis-aligned.
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      expect(a.x === b.x || a.y === b.y).toBe(true);
    }
  });

  it('leaves horizontally when the port has no facing at all', () => {
    expect(orthogonal(req(port('a', 0, 0, null), port('b', 100, 50))))
      .toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }]);
  });
});

describe('bezier', () => {
  const pts = bezier(req(port('a', 0, 0, { x: 1, y: 0 }), port('b', 100, 100, { x: -1, y: 0 })));

  it('starts at one end and lands on the other', () => {
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]!.x).toBeCloseTo(100, 6);
    expect(pts[pts.length - 1]!.y).toBeCloseTo(100, 6);
  });

  it('leaves along the departing port\'s normal', () => {
    // The second sample is still essentially on the outgoing tangent.
    expect(pts[1]!.x).toBeGreaterThan(0);
    expect(Math.abs(pts[1]!.y)).toBeLessThan(pts[1]!.x);
  });

  it('arrives against the receiving port\'s normal', () => {
    const last = pts[pts.length - 1]!;
    const prev = pts[pts.length - 2]!;
    // Coming in from the left, since `to` faces left.
    expect(prev.x).toBeLessThan(last.x);
  });

  it('samples a smooth run rather than two points', () => {
    expect(pts.length).toBeGreaterThan(8);
  });
});

describe('diagramEdgeOf', () => {
  it('reads an edge trait', () => {
    expect(diagramEdgeOf({ data: { diagram: { from: {}, to: {} } } })).toEqual({ from: {}, to: {} });
  });

  it('is null for a participant trait, which names no ends', () => {
    expect(diagramEdgeOf({ data: { diagram: { outline: 'rect' } } })).toBeNull();
  });

  it('is null for a node with no trait at all', () => {
    expect(diagramEdgeOf({ data: {} })).toBeNull();
  });
});

describe('edgeDerivePath', () => {
  const box = (x: number, y: number): RectPose => ({ x, y, width: 40, height: 40 });
  const dep = (pose: RectPose, data: unknown = { diagram: {} }): DerivedDep<RectPose> =>
    ({ node: { id: asNodeId('n'), kind: 'leaf', layer: 'main', parent: null, pose, data } as never, pose });

  const edgeNode = (edge: unknown) => ({ data: { diagram: edge } });
  const derive = edgeDerivePath<RectPose>();

  it('runs from one node to the other', () => {
    const path = derive(edgeNode({ from: {}, to: {} }), [dep(box(0, 0)), dep(box(200, 0))]);
    const coords = [...(path as { coords: Float32Array }).coords];
    // Left box's east port to right box's west port.
    expect(coords.slice(0, 2)).toEqual([40, 20]);
    expect(coords.slice(-2)).toEqual([200, 20]);
  });

  it('picks the port facing the other end, not the nearest one', () => {
    // The target is below, so the south port wins even though east is nearer.
    const path = derive(edgeNode({ from: {}, to: {} }), [dep(box(0, 0)), dep(box(0, 200))]);
    expect([...(path as { coords: Float32Array }).coords].slice(0, 2)).toEqual([20, 40]);
  });

  it('honors a named port over the facing one', () => {
    const path = derive(edgeNode({ from: { port: 'n' }, to: {} }), [dep(box(0, 0)), dep(box(200, 0))]);
    expect([...(path as { coords: Float32Array }).coords].slice(0, 2)).toEqual([20, 0]);
  });

  it('falls back to the facing port when the named one is gone', () => {
    const path = derive(edgeNode({ from: { port: 'nope' }, to: {} }),
      [dep(box(0, 0)), dep(box(200, 0))]);
    expect([...(path as { coords: Float32Array }).coords].slice(0, 2)).toEqual([40, 20]);
  });

  it('routes through the waypoints an author dragged', () => {
    const path = derive(
      edgeNode({ from: {}, to: {}, waypoints: [{ x: 120, y: 90 }] }),
      [dep(box(0, 0)), dep(box(200, 0))],
    );
    const coords = [...(path as { coords: Float32Array }).coords];
    expect(coords.slice(2, 4)).toEqual([120, 90]);
  });

  it('picks a router by key', () => {
    const path = derive(edgeNode({ from: {}, to: {}, router: 'orthogonal' }),
      [dep(box(0, 0)), dep(box(200, 100))]);
    expect([...(path as { coords: Float32Array }).coords].length).toBeGreaterThan(4);
  });

  it('falls back to straight for a router key nobody registered', () => {
    const path = derive(edgeNode({ from: {}, to: {}, router: 'nope' }),
      [dep(box(0, 0)), dep(box(200, 0))]);
    expect([...(path as { coords: Float32Array }).coords]).toHaveLength(4);
  });

  it('takes a consumer router table', () => {
    const diagonal: Router = (r) => [r.from.point, { x: 1, y: 2 }, r.to.point];
    const custom = edgeDerivePath<RectPose>({ routers: { diagonal } });
    const path = custom(edgeNode({ from: {}, to: {}, router: 'diagonal' }),
      [dep(box(0, 0)), dep(box(200, 0))]);
    expect([...(path as { coords: Float32Array }).coords].slice(2, 4)).toEqual([1, 2]);
  });

  it('draws nothing when an endpoint is gone', () => {
    expect(derive(edgeNode({ from: {}, to: {} }), [dep(box(0, 0)), undefined])).toBeNull();
  });

  it('draws nothing when an endpoint takes no part in the diagram', () => {
    // No trait means no ports, and an edge to nowhere paints nothing rather
    // than a line to the origin.
    expect(derive(edgeNode({ from: {}, to: {} }), [dep(box(0, 0)), dep(box(200, 0), {})]))
      .toBeNull();
  });

  it('draws nothing for a node that is not an edge', () => {
    expect(derive({ data: { diagram: { outline: 'rect' } } }, [dep(box(0, 0)), dep(box(200, 0))]))
      .toBeNull();
  });
});

describe('withDiagramRegistry', () => {
  it('registers the edge router so an edge round-trips through toJSON', () => {
    const registry = withDiagramRegistry<RectPose>();
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 90, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { diagram: { from: {}, to: {} } },
      dependsOn: [a, b],
      derivePath: registry.derivePath![DIAGRAM_EDGE],
    });
    const json = scene.toJSON();
    const node = json.nodes.find((n) => n.id === (edge as string))!;
    expect(node.derivePathKey).toBe(DIAGRAM_EDGE);
  });

  it("keeps a consumer's own key on a collision", () => {
    const mine = () => null;
    const registry = withDiagramRegistry<RectPose>({ derivePath: { [DIAGRAM_EDGE]: mine } });
    expect(registry.derivePath![DIAGRAM_EDGE]).toBe(mine);
  });
});
