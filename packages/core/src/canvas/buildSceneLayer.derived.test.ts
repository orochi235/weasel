/**
 * A bare adapter's derived node reaches its painter with the path it derives:
 * no scene is in scope, so the scene layer resolves it from the adapter.
 */
import { describe, it, expect, vi } from 'vitest';
import { PATH_L, PATH_M, type Path } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { buildSceneLayer } from './buildSceneLayer';
import type { NodePaintCtx } from './NodeShape';

type Pose = { x: number; y: number; width: number; height: number };
interface Item {
  id: string;
  layer: string;
  kind?: 'group';
  pose: Pose;
  dependsOn?: string[];
  derivePath?: (node: unknown, deps: readonly ({ pose: Pose } | undefined)[]) => Path | null;
}

const DIMS = { width: 400, height: 300, dpr: 1 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

const line = (from: Pose, to: Pose): Path => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([from.x, from.y, to.x, to.y]),
  fillRule: 'nonzero',
});

const items = (): Item[] => [
  { id: 'a', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 } },
  { id: 'b', layer: 'main', pose: { x: 200, y: 100, width: 10, height: 10 } },
  {
    id: 'edge', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
    dependsOn: ['a', 'b'],
    derivePath: (_n, [from, to]) => (from && to ? line(from.pose, to.pose) : null),
  },
];

function paint(list: Item[]) {
  const adapter = {
    getNodes: () => list,
    getNode: (id: string) => list.find((n) => n.id === id),
    getPose: (id: string) => list.find((n) => n.id === id)!.pose,
    getLayers: () => [{ id: 'main', visible: true }],
    getChildren: (parent: string | null) => (parent === null ? list.map((n) => n.id) : []),
  };
  const drawOne = vi.fn((_n: Item, _p: Pose, _v: unknown, _ctx?: NodePaintCtx): DrawCommand[] => []);
  const layer = buildSceneLayer<Item, Pose>({ drawOne }, adapter as never, () => null, () => null);
  layer.draw(undefined, VIEW, DIMS);
  const ctxOf = (id: string) => drawOne.mock.calls.find(([n]) => n.id === id)![3];
  return { ctxOf };
}

const coords = (path: Path | null | undefined): number[] =>
  (path ? [...(path as { coords: Float32Array }).coords] : []);

describe('buildSceneLayer over a bare adapter', () => {
  it('hands a derived node the path it derives', () => {
    const { ctxOf } = paint(items());
    expect(coords(ctxOf('edge')?.derivedPath)).toEqual([0, 0, 200, 100]);
  });

  it('hands a node that derives nothing no derived path', () => {
    const { ctxOf } = paint(items());
    expect(ctxOf('a')).not.toHaveProperty('derivedPath');
  });

  it('re-derives when the adapter answers a moved dependency', () => {
    const list = items();
    paint(list);
    list[1] = { ...list[1], pose: { x: 50, y: 60, width: 10, height: 10 } };
    expect(coords(paint(list).ctxOf('edge')?.derivedPath)).toEqual([0, 0, 50, 60]);
  });
});

describe('buildSceneLayer over a composing adapter', () => {
  // A container at x = 100 holding `a` and `b` at local x = 0 and 100; the edge is a root.
  function paintFramed(withToPose: boolean, parentOnNode = false) {
    const box: Item = { id: 'box', layer: 'main', kind: 'group', pose: { x: 100, y: 0, width: 10, height: 10 } };
    const a: Item = { id: 'a', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 } };
    const b: Item = { id: 'b', layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 } };
    const edge = items()[2];
    const parentOf: Record<string, string | null> = { box: null, a: 'box', b: 'box', edge: null };
    const list = [box, a, b, edge].map((n) => (parentOnNode ? { ...n, parent: parentOf[n.id] } : n));
    const poseOf = (id: string) => list.find((n) => n.id === id)!.pose;
    const adapter = {
      getNode: (id: string) => list.find((n) => n.id === id),
      getPose: poseOf,
      ...(parentOnNode ? {} : { getParent: (id: string) => parentOf[id] ?? null }),
      getWorldPose: (id: string): Pose => {
        const p = parentOf[id];
        const own = poseOf(id);
        return p ? { ...own, x: own.x + poseOf(p).x, y: own.y + poseOf(p).y } : own;
      },
      composePose: (parent: Pose, child: Pose): Pose => ({ ...child, x: parent.x + child.x, y: parent.y + child.y }),
      getLayers: () => [{ id: 'main', visible: true }],
      getChildren: (parent: string | null) => list.filter((n) => parentOf[n.id] === parent).map((n) => n.id),
    };
    const drawOne = vi.fn((_n: Item, _p: Pose, _v: unknown, _ctx?: NodePaintCtx): DrawCommand[] => []);
    const toPose = withToPose ? { toPose: (o: Item) => adapter.getPose(o.id) } : {};
    buildSceneLayer<Item, Pose>({ drawOne, ...toPose }, adapter as never, () => null, () => null)
      .draw(undefined, VIEW, DIMS);
    return coords(drawOne.mock.calls.find(([n]) => n.id === 'edge')![3]?.derivedPath);
  }

  it('derives a path between where its dependencies are drawn', () => {
    expect(paintFramed(false)).toEqual([100, 0, 200, 0]);
  });

  it('derives the same path through a toPose that answers local poses', () => {
    expect(paintFramed(true)).toEqual([100, 0, 200, 0]);
  });

  it('reads each node\'s parent off the node when the adapter has no getParent', () => {
    expect(paintFramed(true, true)).toEqual([100, 0, 200, 0]);
  });
});
