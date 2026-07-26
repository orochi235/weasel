// Per-factory round-trip tests for the op-factory registry.
//
// For each built-in factory: build an op the normal way, read its
// `(name, args)`, hand them back through `rebuildOp`, and verify the
// reconstructed op behaves identically (apply mutates the adapter the
// same way; invert chains in the expected direction).

import { describe, expect, it } from 'vitest';
import { createInsertOp } from './create';
import { createDeleteOp } from './delete';
import { createTransformOp } from './transform';
import { createSetPathOp, type SetPathFields } from './setPath';
import { createSetTextOp } from './setText';
import { createReparentOp } from './reparent';
import { createMoveToIndexOp } from './reorder';
import { createSetSelectionOp } from './select';
import { rebuildOp } from './registry';
import { asNodeId } from '../scene';
import type { Op } from './types';

interface Node { id: string; value?: number }

function makeFullAdapter() {
  const insertCalls: Node[] = [];
  const removeCalls: string[] = [];
  const poseCalls: Array<[string, unknown]> = [];
  const pathCalls: Array<[string, SetPathFields]> = [];
  const textCalls: Array<[string, string]> = [];
  const parentCalls: Array<[string, string | null]> = [];
  const selectionCalls: string[][] = [];
  const orderCalls: Array<[string | null, string[]]> = [];

  // For createMoveToIndexOp, the adapter needs read-side methods too.
  const parents = new Map<string, string | null>();
  const children = new Map<string | null, string[]>();

  return {
    insertNode: (n: Node) => { insertCalls.push(n); },
    removeNode: (id: string) => { removeCalls.push(id); },
    setPose: (id: string, pose: unknown) => { poseCalls.push([id, pose]); },
    setPath: (id: string, fields: SetPathFields) => { pathCalls.push([id, fields]); },
    setText: (id: string, text: string) => { textCalls.push([id, text]); },
    setParent: (id: string, parentId: string | null) => { parentCalls.push([id, parentId]); },
    setSelection: (ids: string[]) => { selectionCalls.push([...ids]); },
    getParent: (id: string) => parents.get(id) ?? null,
    getChildren: (parentId: string | null) => (children.get(parentId) ?? []).slice(),
    setChildOrder: (parentId: string | null, ids: string[]) => {
      children.set(parentId, ids.slice());
      orderCalls.push([parentId, ids.slice()]);
    },
    insertCalls, removeCalls, poseCalls, pathCalls, textCalls,
    parentCalls, selectionCalls, orderCalls, parents, children,
  };
}

/** Apply original + rebuilt to two fresh adapters and assert they produced
 *  the same observable mutation. */
function applyBoth(make: () => Op, pick: (a: ReturnType<typeof makeFullAdapter>) => unknown): void {
  const a = makeFullAdapter();
  const b = makeFullAdapter();
  const original = make();
  original.apply(a);
  const rebuilt = rebuildOp(original.name!, original.args)!;
  rebuilt.apply(b);
  expect(pick(b)).toEqual(pick(a));
}

describe('op-factory registry — per-factory round trip', () => {
  it('insert', () => {
    const node = { id: 'r1', value: 7 };
    applyBoth(
      () => createInsertOp<Node>({ node }),
      (ad) => ad.insertCalls,
    );

    // Inverted op also round-trips and inverts to a delete.
    const op = createInsertOp<Node>({ node });
    const inverted = op.invert();
    expect(inverted.name).toBe('delete');
    const rebuiltInverted = rebuildOp(inverted.name!, inverted.args)!;
    const a = makeFullAdapter();
    rebuiltInverted.apply(a);
    expect(a.removeCalls).toEqual(['r1']);
  });

  it('delete', () => {
    const node = { id: 'r1', value: 3 };
    applyBoth(
      () => createDeleteOp<Node>({ node, index: 0 }),
      (ad) => ad.removeCalls,
    );

    // The inverse of delete is insert, with the captured node — that, too,
    // round-trips through the registry.
    const op = createDeleteOp<Node>({ node, index: 0 });
    const inverted = op.invert();
    expect(inverted.name).toBe('insert');
    const rebuiltInverted = rebuildOp(inverted.name!, inverted.args)!;
    const a = makeFullAdapter();
    rebuiltInverted.apply(a);
    expect(a.insertCalls).toEqual([node]);
  });

  it('transform', () => {
    const args = { id: 'r1', from: { x: 0, y: 0 }, to: { x: 10, y: 20 }, label: 'Move' };
    applyBoth(
      () => createTransformOp(args),
      (ad) => ad.poseCalls,
    );
    // Invert round-trips too.
    const op = createTransformOp(args);
    const inv = op.invert();
    expect(inv.name).toBe('transform');
    const rebuilt = rebuildOp(inv.name!, inv.args)!;
    const a = makeFullAdapter();
    rebuilt.apply(a);
    expect(a.poseCalls).toEqual([['r1', { x: 0, y: 0 }]]);
  });

  it('setPath', () => {
    const from: SetPathFields = { path: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 }, closed: true, params: {} };
    const to: SetPathFields = { path: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 }, closed: true, params: {} };
    applyBoth(
      () => createSetPathOp({ id: 'r1', from, to }),
      (ad) => ad.pathCalls,
    );
  });

  it('setText', () => {
    applyBoth(
      () => createSetTextOp({ id: 't1', from: 'hi', to: 'hello' }),
      (ad) => ad.textCalls,
    );
  });

  it('reparent', () => {
    applyBoth(
      () => createReparentOp({ id: 'r1', fromParentId: null, toParentId: 'g1' }),
      (ad) => ad.parentCalls,
    );
  });

  it('moveToIndex', () => {
    // Seed the adapter so the algorithm has a non-empty child list to work
    // against. Use the same seed for both the original and rebuilt run so
    // their `prevPositions` capture is identical.
    function seeded() {
      const a = makeFullAdapter();
      a.children.set(null, ['r1', 'r2', 'r3']);
      a.parents.set('r1', null);
      a.parents.set('r2', null);
      a.parents.set('r3', null);
      return a;
    }
    const aOrig = seeded();
    const aReb = seeded();
    const original = createMoveToIndexOp({ ids: ['r3'], parentId: null, index: 0 });
    original.apply(aOrig);
    // `args.prevPositions` is populated post-apply.
    expect((original.args as { prevPositions?: string[] }).prevPositions).toEqual(['r1', 'r2', 'r3']);
    const rebuilt = rebuildOp(original.name!, original.args)!;
    rebuilt.apply(aReb);
    expect(aReb.orderCalls).toEqual(aOrig.orderCalls);
    // Invert of the rebuilt op restores the prior order (round-trip across
    // serialization is the whole point — invert must work post-restore).
    const aRebInv = seeded();
    // First apply rebuilt to align state, then invert.
    rebuilt.invert().apply(aRebInv);
    expect(aRebInv.orderCalls[aRebInv.orderCalls.length - 1]).toEqual([null, ['r1', 'r2', 'r3']]);
  });

  it('setSelection', () => {
    applyBoth(
      () => createSetSelectionOp({ from: [asNodeId('a')], to: [asNodeId('b'), asNodeId('c')] }),
      (ad) => ad.selectionCalls,
    );
  });
});
