import { describe, it, expect, beforeEach } from 'vitest';
import { computeSliceOps, type SliceLeaf, type WDLeafNode } from './sliceCommit';
import { rectPath, type NodeId } from '@weasel-js/core';

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
      fill: '#ff0000',
      stroke: '#000000',
      strokeWidth: 2,
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
    const ops = computeSliceOps({
      leaves: [leaf],
      a: { x: -10, y: 50 },
      b: { x: 110, y: 50 },
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
    const ops = computeSliceOps({
      leaves: [leaf],
      a: { x: 200, y: 0 },
      b: { x: 200, y: 100 },
      nextId,
    });

    expect(ops).toHaveLength(0);
  });

  it('fill and stroke are carried onto inserted piece nodes', () => {
    const node = makeLeafNode({
      data: {
        path: squarePath,
        fill: '#abcdef',
        stroke: '#fedcba',
        strokeWidth: 3,
      },
    });

    const leaf: SliceLeaf = {
      node,
      index: 2,
      worldPath: squarePath,
    };

    const ops = computeSliceOps({
      leaves: [leaf],
      a: { x: -10, y: 50 },
      b: { x: 110, y: 50 },
      nextId,
    });

    expect(ops).toHaveLength(3);

    for (const op of ops.slice(1)) {
      const inserted = (op as { args: { node: WDLeafNode } }).args.node;
      expect(inserted.data.fill).toBe('#abcdef');
      expect(inserted.data.stroke).toBe('#fedcba');
      expect(inserted.data.strokeWidth).toBe(3);
      // Each piece should have a path set.
      expect(inserted.data.path).toBeDefined();
    }
  });

  it('two crossed leaves → ops concatenated per leaf, both deletes carry their own node', () => {
    const leafA: SliceLeaf = {
      node: makeLeafNode({ id: 'a' as NodeId, data: { path: squarePath, fill: '#aaaaaa' } }),
      index: 0,
      worldPath: squarePath,
    };
    const leafB: SliceLeaf = {
      node: makeLeafNode({ id: 'b' as NodeId, data: { path: squarePath, fill: '#bbbbbb' } }),
      index: 1,
      worldPath: squarePath,
    };

    const ops = computeSliceOps({
      leaves: [leafA, leafB],
      a: { x: -10, y: 50 },
      b: { x: 110, y: 50 },
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
      expect((op as { args: { node: WDLeafNode } }).args.node.data.fill).toBe('#aaaaaa');
    }
    for (const op of ops.slice(4, 6)) {
      expect((op as { args: { node: WDLeafNode } }).args.node.data.fill).toBe('#bbbbbb');
    }

    // All four inserted ids are distinct.
    const insertedIds = [ops[1], ops[2], ops[4], ops[5]].map(
      (o) => (o as { args: { node: WDLeafNode } }).args.node.id,
    );
    expect(new Set(insertedIds).size).toBe(4);
  });
});
