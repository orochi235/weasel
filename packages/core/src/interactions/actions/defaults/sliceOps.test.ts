import { describe, it, expect, beforeEach } from 'vitest';
import { rectPath, polylineFromPoints, PATH_Z, type Path, type PolygonPath } from '@weasel-js/geom';
import { computeSliceOps, type SliceLeaf } from './sliceOps';

interface Data { path?: Path; fill?: string }
interface TestNode {
  id: string;
  kind: 'leaf';
  layer: string;
  parent: string | null;
  pose: { x: number; y: number; width: number; height: number; rotation?: number };
  data: Data;
}

const square = rectPath(0, 0, 100, 100);
const across = [{ x: -10, y: 50 }, { x: 110, y: 50 }];

function leafOf(over: Partial<TestNode> = {}, index = 0): SliceLeaf<TestNode> {
  const node: TestNode = {
    id: 'n', kind: 'leaf', layer: 'default', parent: null,
    pose: { x: 0, y: 0, width: 100, height: 100 },
    data: { path: square, fill: 'red' },
    ...over,
  };
  return { node, index, worldPath: node.data.path! };
}

let seq = 0;
const nextId = () => `p${++seq}`;
const inserted = (ops: ReturnType<typeof computeSliceOps>['ops']) =>
  ops.filter((o) => o.name === 'insert').map((o) => (o as unknown as { args: { node: TestNode } }).args.node);

describe('computeSliceOps', () => {
  beforeEach(() => { seq = 0; });

  it('swaps a crossed leaf for its pieces: one delete carrying the whole node, then an insert per piece', () => {
    const leaf = leafOf();
    const { ops } = computeSliceOps({ leaves: [leaf], cut: across, nextId });
    expect(ops.map((o) => o.name)).toEqual(['delete', 'insert', 'insert']);
    expect((ops[0] as unknown as { args: { node: TestNode } }).args.node).toBe(leaf.node);
    const pieces = inserted(ops);
    expect(new Set(pieces.map((p) => p.id))).toEqual(new Set(['p1', 'p2']));
    for (const p of pieces) expect(p.data.fill).toBe('red');
  });

  it('emits nothing for a leaf the cut misses', () => {
    const { ops, nextSelection } = computeSliceOps({
      leaves: [leafOf()], cut: [{ x: 200, y: 0 }, { x: 200, y: 100 }], nextId, selection: ['n'],
    });
    expect(ops).toEqual([]);
    expect(nextSelection).toBeNull();
  });

  it('places each piece at its own bounds and drops the rotation baked into its path', () => {
    const { ops } = computeSliceOps({
      leaves: [leafOf({ pose: { x: 0, y: 0, width: 100, height: 100, rotation: 0 } })],
      cut: [{ x: 50, y: -10 }, { x: 50, y: 50 }, { x: 110, y: 50 }],
      nextId,
    });
    const poses = inserted(ops).map((p) => p.pose);
    expect(poses).toContainEqual({ x: 50, y: 0, width: 50, height: 50 });
    for (const p of poses) expect(p).not.toHaveProperty('rotation');
  });

  it('hands the piece pose to `placePiece` when one is given', () => {
    const { ops } = computeSliceOps({
      leaves: [leafOf()], cut: across, nextId,
      placePiece: (_leaf, pose) => ({ ...pose, x: pose.x - 7 }),
    });
    expect(inserted(ops).map((p) => p.pose.x)).toEqual([-7, -7]);
  });

  it('snips an open path into open runs, and knifes a closed one into closed pieces', () => {
    const open = polylineFromPoints([{ x: 0, y: 50 }, { x: 50, y: 0 }, { x: 100, y: 50 }]);
    const snipped = inserted(computeSliceOps({
      leaves: [leafOf({ data: { path: open } })], cut: [{ x: -10, y: 30 }, { x: 110, y: 30 }], nextId,
    }).ops);
    expect(snipped).toHaveLength(3);
    for (const p of snipped) expect(Array.from((p.data.path as PolygonPath).commands)).not.toContain(PATH_Z);

    const knifed = inserted(computeSliceOps({ leaves: [leafOf()], cut: across, nextId }).ops);
    for (const p of knifed) expect(Array.from((p.data.path as PolygonPath).commands)).toContain(PATH_Z);
  });

  it('cuts out the region a closed loop encloses, leaving a hole in the piece around it', () => {
    const loop = [{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 70, y: 70 }, { x: 30, y: 70 }, { x: 30, y: 30 }];
    const pieces = inserted(computeSliceOps({ leaves: [leafOf()], cut: loop, nextId }).ops);
    const bounds = pieces.map((p) => p.pose);
    expect(bounds).toContainEqual({ x: 30, y: 30, width: 40, height: 40 });
    expect(bounds).toContainEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('keeps paint order: siblings are swapped from the top down, so an earlier swap never shifts a later slot', () => {
    const { ops } = computeSliceOps({
      leaves: [leafOf({ id: 'a' }, 0), leafOf({ id: 'b' }, 1)], cut: across, nextId,
    });
    const order = ops.map((o) => {
      const a = (o as unknown as { args: { node: TestNode; slot?: { index?: number } } }).args;
      return `${o.name}:${a.node.id}`;
    });
    expect(order.slice(0, 1)).toEqual(['delete:b']);
    expect(order[3]).toBe('delete:a');
  });

  describe('selection', () => {
    it('is null when no selection is given', () => {
      expect(computeSliceOps({ leaves: [leafOf()], cut: across, nextId }).nextSelection).toBeNull();
    });

    it('replaces a selected source with its pieces and keeps what the cut missed', () => {
      const { ops, nextSelection } = computeSliceOps({
        leaves: [leafOf({ id: 'a' })], cut: across, nextId, selection: ['a', 'survivor'],
      });
      expect(nextSelection).toEqual(['survivor', ...inserted(ops).map((p) => p.id)]);
    });

    it('leaves the pieces of an unselected source unselected', () => {
      const { nextSelection } = computeSliceOps({
        leaves: [leafOf({ id: 'a' })], cut: across, nextId, selection: ['other'],
      });
      expect(nextSelection).toEqual(['other']);
    });
  });
});
