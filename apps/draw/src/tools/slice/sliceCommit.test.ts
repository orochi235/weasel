import { describe, it, expect, beforeEach } from 'vitest';
import { computeSliceOps, type SliceLeaf, type WDLeafNode } from './sliceCommit';
import { rectPath, polylineFromPoints, PATH_Z, type NodeId, type PolygonPath } from '@weasel-js/core';
import { solid, strokeOf } from '@weasel-js/core';


// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** A 100×100 square at the origin in world space. */
const squarePath = rectPath(0, 0, 100, 100);

/** Build a minimal but complete WDLeafNode for undo-faithfulness tests. */
function makeLeafNode(overrides: Partial<WDLeafNode> = {}): WDLeafNode {
  return {
    id: 'node-1' as NodeId,
    kind: 'leaf',
    layer: 'default',
    parent: null,
    pose: { x: 0, y: 0, width: 100, height: 100 },
    data: {
      path: squarePath,
      fill: solid('#ff0000'),
      stroke: strokeOf('#000000', 2),
    },
    ...overrides,
  };
}

let _idCounter = 0;
const nextId = () => `new-${++_idCounter}`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeSliceOps', () => {
  beforeEach(() => {
    _idCounter = 0;
  });

  it('crossed leaf → 1 delete + 2 inserts', () => {
    const leaf: SliceLeaf = {
      node: makeLeafNode(),
      index: 0,
      worldPath: squarePath,
    };

    // Slice horizontally across the middle of the 100×100 square.
    const { ops } = computeSliceOps({
      leaves: [leaf],
      cut: [{ x: -10, y: 50 },
        { x: 110, y: 50 }],
      nextId,
    });

    // 1 delete + 2 inserts
    expect(ops).toHaveLength(3);
    expect(ops[0].name).toBe('delete');
    expect(ops[1].name).toBe('insert');
    expect(ops[2].name).toBe('insert');

    // The delete op carries the full node (for faithful undo).
    expect((ops[0] as { args: { node: WDLeafNode } }).args.node).toBe(leaf.node);

    // Each insert op carries a new node with a fresh id.
    const insertedA = (ops[1] as { args: { node: WDLeafNode } }).args.node;
    const insertedB = (ops[2] as { args: { node: WDLeafNode } }).args.node;
    expect(insertedA.id).not.toBe(leaf.node.id);
    expect(insertedB.id).not.toBe(leaf.node.id);
    expect(insertedA.id).not.toBe(insertedB.id);
  });

  it('missed leaf → empty op list', () => {
    const leaf: SliceLeaf = {
      node: makeLeafNode(),
      index: 0,
      worldPath: squarePath,
    };

    // Slice segment entirely to the right of the square — no crossings.
    const { ops } = computeSliceOps({
      leaves: [leaf],
      cut: [{ x: 200, y: 0 },
        { x: 200, y: 100 }],
      nextId,
    });

    expect(ops).toHaveLength(0);
  });

  it('fill and stroke are carried onto inserted piece nodes', () => {
    const node = makeLeafNode({
      data: {
        path: squarePath,
        fill: solid('#abcdef'),
        stroke: strokeOf('#fedcba', 3),
      },
    });

    const leaf: SliceLeaf = {
      node,
      index: 2,
      worldPath: squarePath,
    };

    const { ops } = computeSliceOps({
      leaves: [leaf],
      cut: [{ x: -10, y: 50 },
        { x: 110, y: 50 }],
      nextId,
    });

    expect(ops).toHaveLength(3);

    for (const op of ops.slice(1)) {
      const inserted = (op as { args: { node: WDLeafNode } }).args.node;
      expect(inserted.data.fill).toEqual({ color: '#abcdef' });
      expect(inserted.data.stroke).toEqual({ paint: { color: '#fedcba' }, width: 3 });
      // Each piece should have a path set.
      expect(inserted.data.path).toBeDefined();
    }
  });

  it('two crossed leaves → ops concatenated per leaf, both deletes carry their own node', () => {
    const leafA: SliceLeaf = {
      node: makeLeafNode({ id: 'a' as NodeId, data: { path: squarePath, fill: solid('#aaaaaa') } }),
      index: 0,
      worldPath: squarePath,
    };
    const leafB: SliceLeaf = {
      node: makeLeafNode({ id: 'b' as NodeId, data: { path: squarePath, fill: solid('#bbbbbb') } }),
      index: 1,
      worldPath: squarePath,
    };

    const { ops } = computeSliceOps({
      leaves: [leafA, leafB],
      cut: [{ x: -10, y: 50 },
        { x: 110, y: 50 }],
      nextId,
    });

    // Each crossed leaf contributes 1 delete + 2 inserts = 6 ops, leaf A first.
    expect(ops.map((o) => o.name)).toEqual([
      'delete', 'insert', 'insert',
      'delete', 'insert', 'insert',
    ]);

    // Each delete references its own original node (faithful undo, no cross-talk).
    expect((ops[0] as { args: { node: WDLeafNode } }).args.node).toBe(leafA.node);
    expect((ops[3] as { args: { node: WDLeafNode } }).args.node).toBe(leafB.node);

    // Pieces inherit the fill of their source leaf, not the other leaf's.
    for (const op of ops.slice(1, 3)) {
      expect((op as { args: { node: WDLeafNode } }).args.node.data.fill).toEqual({ color: '#aaaaaa' });
    }
    for (const op of ops.slice(4, 6)) {
      expect((op as { args: { node: WDLeafNode } }).args.node.data.fill).toEqual({ color: '#bbbbbb' });
    }

    // All four inserted ids are distinct.
    const insertedIds = [ops[1], ops[2], ops[4], ops[5]].map(
      (o) => (o as { args: { node: WDLeafNode } }).args.node.id,
    );
    expect(new Set(insertedIds).size).toBe(4);
  });

  it('an open path is snipped into open pieces rather than closed by the knife', () => {
    const open = polylineFromPoints([{ x: 0, y: 50 }, { x: 50, y: 0 }, { x: 100, y: 50 }]);
    const leaf: SliceLeaf = { node: makeLeafNode({ data: { path: open } }), index: 0, worldPath: open };
    const { ops } = computeSliceOps({ leaves: [leaf], cut: [{ x: -10, y: 30 }, { x: 110, y: 30 }], nextId });
    const pieces = ops.slice(1).map((o) => (o as { args: { node: WDLeafNode } }).args.node.data.path as PolygonPath);
    expect(pieces).toHaveLength(3);
    for (const p of pieces) expect(Array.from(p.commands)).not.toContain(PATH_Z);
  });

  it('a closed path is still knifed into closed pieces', () => {
    const leaf: SliceLeaf = { node: makeLeafNode(), index: 0, worldPath: squarePath };
    const { ops } = computeSliceOps({ leaves: [leaf], cut: [{ x: -10, y: 50 }, { x: 110, y: 50 }], nextId });
    for (const op of ops.slice(1)) {
      const p = (op as { args: { node: WDLeafNode } }).args.node.data.path as PolygonPath;
      expect(Array.from(p.commands)).toContain(PATH_Z);
    }
  });

  it('a bent cut splits along every point of it', () => {
    const leaf: SliceLeaf = { node: makeLeafNode(), index: 0, worldPath: squarePath };
    const { ops } = computeSliceOps({
      leaves: [leaf],
      cut: [{ x: 50, y: -10 }, { x: 50, y: 50 }, { x: 110, y: 50 }],
      nextId,
    });
    const poses = ops.slice(1).map((o) => (o as { args: { node: WDLeafNode } }).args.node.pose);
    expect(poses).toContainEqual({ x: 50, y: 0, width: 50, height: 50 });
  });

  it('no `selection` arg → nextSelection is null (pure-geometry callers unchanged)', () => {
    const leaf: SliceLeaf = { node: makeLeafNode(), index: 0, worldPath: squarePath };
    const { nextSelection } = computeSliceOps({
      leaves: [leaf],
      cut: [{ x: -10, y: 50 }, { x: 110, y: 50 }],
      nextId,
    });
    expect(nextSelection).toBeNull();
  });
});

describe('computeSliceOps — post-op selection (pieces inherit source state)', () => {
  beforeEach(() => { _idCounter = 0; });

  const horizontalSlice = { cut: [{ x: -10, y: 50 }, { x: 110, y: 50 }] };

  /** Piece ids minted by the inserts, in order. */
  function insertedIds(ops: ReturnType<typeof computeSliceOps>['ops']): string[] {
    return ops
      .filter((o) => o.name === 'insert')
      .map((o) => (o as { args: { node: WDLeafNode } }).args.node.id);
  }

  it('selected source → its pieces replace the source in the selection', () => {
    const leaf: SliceLeaf = {
      node: makeLeafNode({ id: 'sel' as NodeId }),
      index: 0,
      worldPath: squarePath,
    };
    const { ops, nextSelection } = computeSliceOps({ leaves: [leaf], ...horizontalSlice, nextId, selection: ['sel'] });

    const pieceIds = insertedIds(ops);
    expect(pieceIds).toHaveLength(2);
    // The pieces become the new selection; the deleted source id is gone.
    expect(nextSelection).toEqual(pieceIds);
    expect(nextSelection).not.toContain('sel');
  });

  it('unselected source → pieces are NOT selected (selection unchanged)', () => {
    const leaf: SliceLeaf = {
      node: makeLeafNode({ id: 'cut' as NodeId }),
      index: 0,
      worldPath: squarePath,
    };
    // A different node is selected; slicing `cut` must not select its pieces.
    const { nextSelection } = computeSliceOps({ leaves: [leaf], ...horizontalSlice, nextId, selection: ['other'] });
    expect(nextSelection).toEqual(['other']);
  });

  it('selected node the slice MISSED stays selected; sliced selected source is replaced', () => {
    const sliced: SliceLeaf = {
      node: makeLeafNode({ id: 'a' as NodeId }),
      index: 0,
      worldPath: squarePath,
    };
    const { ops, nextSelection } = computeSliceOps({
      leaves: [sliced],
      ...horizontalSlice,
      nextId,
      selection: ['a', 'survivor'],
    });
    // survivor kept; sliced 'a' replaced by its pieces; order: survivors then pieces.
    expect(nextSelection).toEqual(['survivor', ...insertedIds(ops)]);
  });

  it('mixed: only the selected source contributes its pieces', () => {
    const leafSel: SliceLeaf = {
      node: makeLeafNode({ id: 'sel' as NodeId }),
      index: 0,
      worldPath: squarePath,
    };
    const leafUnsel: SliceLeaf = {
      node: makeLeafNode({ id: 'unsel' as NodeId }),
      index: 1,
      worldPath: squarePath,
    };
    const { nextSelection } = computeSliceOps({
      leaves: [leafSel, leafUnsel],
      ...horizontalSlice,
      nextId,
      selection: ['sel'],
    });
    // The selected source 'sel' is sliced first → its two pieces are new-1,new-2.
    expect(nextSelection).toEqual(['new-1', 'new-2']);
  });

  it('nothing sliced → empty ops and null nextSelection even with a selection', () => {
    const leaf: SliceLeaf = { node: makeLeafNode({ id: 'a' as NodeId }), index: 0, worldPath: squarePath };
    const { ops, nextSelection } = computeSliceOps({
      leaves: [leaf],
      cut: [{ x: 200, y: 0 }, { x: 200, y: 100 }], // misses the square
      nextId,
      selection: ['a'],
    });
    expect(ops).toHaveLength(0);
    expect(nextSelection).toBeNull();
  });
});
