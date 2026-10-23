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

const DIMS = { width: 400, height: 300 };
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

  it('hands a node that derives nothing no context', () => {
    const { ctxOf } = paint(items());
    expect(ctxOf('a')).toBeUndefined();
  });

  it('re-derives when the adapter answers a moved dependency', () => {
    const list = items();
    paint(list);
    list[1] = { ...list[1], pose: { x: 50, y: 60, width: 10, height: 10 } };
    expect(coords(paint(list).ctxOf('edge')?.derivedPath)).toEqual([0, 0, 50, 60]);
  });
});
