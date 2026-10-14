import { describe, expect, it } from 'vitest';
import { PathBuilder, boundsOfPath, type PolygonPath } from '@weasel-js/geom';
import { createInsertOp } from 'core/ops/create';
import { createDeleteOp } from 'core/ops/delete';
import type { Op } from 'core/ops/types';
import { mirrorInsertOps } from './mirrorInserts';
import { symmetryImages } from './images';

type Node = { id: string; kind: string; layer: string; pose: Record<string, number>; data: { path?: PolygonPath; text?: string } };

/** An open, lopsided stroke left of x = 100: from (20, 10) to (60, 50). */
function stroke(): PolygonPath {
  return new PathBuilder().moveTo(20, 10).lineTo(60, 50).lineTo(40, 50).build();
}

function insertOf(node: Node): Op {
  return createInsertOp({ node, label: 'Insert path' });
}

function nodesOf(ops: readonly Op[]): Node[] {
  return ops.filter((op) => op.name === 'insert').map((op) => (op.args as { node: Node }).node);
}

function minter(): () => string {
  let n = 0;
  return () => `twin-${++n}`;
}

const pathNode = (): Node => {
  const path = stroke();
  const { x, y, width, height } = boundsOfPath(path);
  return { id: 'a', kind: 'leaf', layer: 'default', pose: { x, y, width, height }, data: { path } };
};

describe('symmetryImages', () => {
  it('has one mirror per axis and the turn through the center for both', () => {
    const c = { x: 100, y: 50 };
    expect(symmetryImages({ axis: 'vertical', center: c }).map((i) => i.flips)).toEqual([['x']]);
    expect(symmetryImages({ axis: 'horizontal', center: c }).map((i) => i.flips)).toEqual([['y']]);
    expect(symmetryImages({ axis: 'both', center: c }).map((i) => i.flips)).toEqual([['x'], ['y'], ['x', 'y']]);
    expect(symmetryImages({ axis: 'vertical', center: c })[0].m).toEqual([-1, 0, 0, 1, 200, 0]);
  });
});

describe('mirrorInsertOps', () => {
  it('passes the ops through untouched while symmetry is off', () => {
    const ops = [insertOf(pathNode())];
    expect(mirrorInsertOps(ops, null, { mintId: minter() })).toEqual(ops);
  });

  it('adds a twin mirrored across a vertical axis, path and pose both', () => {
    const ops = mirrorInsertOps([insertOf(pathNode())], { axis: 'vertical', center: { x: 100, y: 0 } }, { mintId: minter() });
    const [orig, twin] = nodesOf(ops);
    expect(orig.id).toBe('a');
    expect(twin.id).toBe('twin-1');
    expect(twin.pose).toMatchObject({ x: 140, y: 10, width: 40, height: 40 });
    expect([...twin.data.path!.coords]).toEqual([180, 10, 140, 50, 160, 50]);
  });

  it('adds three twins for both axes', () => {
    const ops = mirrorInsertOps([insertOf(pathNode())], { axis: 'both', center: { x: 100, y: 100 } }, { mintId: minter() });
    const twins = nodesOf(ops).slice(1);
    expect(twins.map((n) => [n.pose.x, n.pose.y])).toEqual([[140, 10], [20, 150], [140, 150]]);
    expect([...twins[2].data.path!.coords]).toEqual([180, 190, 140, 150, 160, 150]);
  });

  it('negates a turned pose, since a mirror reverses the sense of the turn', () => {
    const node = { ...pathNode(), pose: { ...pathNode().pose, rotation: 0.3 } };
    const [, twin] = nodesOf(mirrorInsertOps([insertOf(node)], { axis: 'vertical', center: { x: 100, y: 0 } }, { mintId: minter() }));
    expect(twin.pose.rotation).toBeCloseTo(-0.3);
  });

  it('mirrors data through the geometry projection when one is given', () => {
    const seen: number[][] = [];
    const ops = mirrorInsertOps([insertOf(pathNode())], { axis: 'vertical', center: { x: 100, y: 0 } }, {
      mintId: minter(),
      geometryProjection: { transform: (n, m) => { seen.push([...m]); return { ...(n.data as object), mirrored: true }; } },
    });
    expect(seen).toEqual([[-1, 0, 0, 1, 200, 0]]);
    expect(nodesOf(ops)[1].data).toMatchObject({ mirrored: true });
  });

  it('makes no twin of a node with no geometry to mirror', () => {
    const text: Node = { id: 't', kind: 'leaf', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { text: '' } };
    const ops = [insertOf(text)];
    expect(mirrorInsertOps(ops, { axis: 'vertical', center: { x: 100, y: 0 } }, { mintId: minter() })).toEqual(ops);
  });

  it('leaves every op that is not an insert alone, in place', () => {
    const del = createDeleteOp({ node: { id: 'z' } as never });
    const ops = mirrorInsertOps([del, insertOf(pathNode())], { axis: 'vertical', center: { x: 100, y: 0 } }, { mintId: minter() });
    expect(ops[0]).toBe(del);
    expect(nodesOf(ops)).toHaveLength(2);
  });
});
