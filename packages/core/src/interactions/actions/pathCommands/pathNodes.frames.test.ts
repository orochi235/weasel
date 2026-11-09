import { describe, expect, it } from 'vitest';
import { PathBuilder, boundsOfPath, pathInWorld, type PolygonPath } from '@weasel-js/geom';
import type { ImmediateInvoker, InvocationCtx } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import { snipAtCrossingsAction } from './cutJoin';
import { pathCopy, pathNodesOf, reshapeOps } from './pathNodes';

type AnyScene = Scene<unknown, string, unknown>;

const line = (x0: number, y0: number, x1: number, y1: number): PolygonPath =>
  new PathBuilder().moveTo(x0, y0).lineTo(x1, y1).build() as PolygonPath;

/** A root line from x=50 to x=150 at y=50, and a vertical line at world x=100
 *  stored in a group whose frame sits at (`gx`, 0), turned `rotation`. */
function crossing(gx = 90, rotation = 0) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const root = scene.add({ kind: 'mark', layer: 'main', data: { path: line(0, 0, 100, 0) }, pose: { x: 50, y: 50, width: 100, height: 0 } });
  const group = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: gx, y: 0, width: 20, height: 100, rotation } });
  const inner = scene.add({ kind: 'mark', parent: group, layer: 'main', data: { path: line(0, 0, 0, 100) }, pose: { x: 10, y: 0, width: 0, height: 100 } });
  return { scene: scene as unknown as AnyScene, root, group, inner };
}

const apply = (scene: AnyScene) => (ops: Op[], label: string) => { scene.applyBatch(ops, label, defaultCommitAdapter(scene)); };

describe('path nodes inside a frame', () => {
  it('reads a framed node’s path in world', () => {
    const { scene, inner } = crossing();
    const [node] = pathNodesOf(scene, [inner]);
    expect(boundsOfPath(node.path)).toMatchObject({ x: 100, y: 0, width: 0, height: 100 });
  });

  it('reads through a turned frame', () => {
    const { scene, inner } = crossing(90, Math.PI / 2);
    const b = boundsOfPath(pathNodesOf(scene, [inner])[0].path);
    // A 20×100 box turned about its center (100, 50) lays the line along y=50.
    expect(b.y).toBeCloseTo(50);
    expect(b.height).toBeCloseTo(0);
    expect(b.x).toBeCloseTo(50);
    expect(b.width).toBeCloseTo(100);
  });

  it('stores a world edit back into the node’s frame', () => {
    const { scene, inner } = crossing(90, Math.PI / 6);
    const [node] = pathNodesOf(scene, [inner]);
    const moved = line(0, 0, 40, 40);
    apply(scene)(reshapeOps(node, moved, 'Edit'), 'Edit');
    const [after] = pathNodesOf(scene, [inner]);
    const b = boundsOfPath(after.path);
    expect(b.x).toBeCloseTo(0);
    expect(b.y).toBeCloseTo(0);
    expect(b.width).toBeCloseTo(40);
    expect(b.height).toBeCloseTo(40);
  });

  it('puts a copy in the source’s frame', () => {
    const { scene, inner, group } = crossing(90, 0);
    const node = pathCopy(scene, pathNodesOf(scene, [inner])[0], line(100, 10, 100, 20))!;
    expect(node.parent).toBe(group);
    const shown = pathInWorld((node.data as { path: PolygonPath }).path, { ...(node.pose as RectPose), x: (node.pose as RectPose).x + 90 });
    expect(boundsOfPath(shown)).toMatchObject({ x: 100, y: 10, height: 10 });
  });

  it('cuts across a framed group at the crossing', () => {
    const { scene, root, group, inner } = crossing();
    const deps = { scene, selection: { get: () => [root, inner], set: () => {} }, applyOps: apply(scene) } as unknown as InvocationCtx['deps'];
    (snipAtCrossingsAction.invoker as ImmediateInvoker).run(deps!, undefined as never);
    const leaves = [...scene.renderOrder()].filter((id) => scene.get(id)!.kind === 'mark');
    const world = pathNodesOf(scene, leaves).map((n) => {
      const b = boundsOfPath(n.path);
      return [b.x, b.y, b.x + b.width, b.y + b.height];
    });
    expect(world).toEqual([[50, 50, 100, 50], [100, 50, 150, 50], [100, 0, 100, 50], [100, 50, 100, 100]]);
    expect(leaves.slice(2).every((id) => scene.get(id as NodeId)!.parent === group)).toBe(true);
  });
});
