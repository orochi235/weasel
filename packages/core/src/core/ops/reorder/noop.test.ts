import { expect, it } from 'vitest';
import { makeScene, POSE } from 'core/scene/testing/makeScene';
import { sceneMutators } from 'core/scene/sceneMutators';
import { createMoveToIndexOp, createSetChildOrderOp } from './index';

function twoRoots() {
  const s = makeScene();
  const a = s.add({ kind: 'm', layer: 'structures', pose: POSE, data: { label: 'a' } });
  const b = s.add({ kind: 'm', layer: 'structures', pose: POSE, data: { label: 'b' } });
  return { s, a, b, entries: s.historyEntries().length, adapter: sceneMutators(s) };
}

it('records nothing for a move to the index a node already holds', () => {
  const { s, a, entries, adapter } = twoRoots();
  s.applyBatch([createMoveToIndexOp({ ids: [a], parentId: null, index: 0 })], 'Move', adapter);
  expect(s.historyEntries()).toHaveLength(entries);
});

it('records nothing for a child order the parent already has', () => {
  const { s, a, b, entries, adapter } = twoRoots();
  s.applyBatch([createSetChildOrderOp({ orders: [{ parentId: null, ids: [a, b] }] })], 'Order', adapter);
  expect(s.historyEntries()).toHaveLength(entries);
});

it('still records and undoes a child order that changes', () => {
  const { s, a, b, entries, adapter } = twoRoots();
  s.applyBatch([createSetChildOrderOp({ orders: [{ parentId: null, ids: [b, a] }] })], 'Order', adapter);
  expect(s.historyEntries()).toHaveLength(entries + 1);
  expect(s.roots).toEqual([b, a]);
  s.undo();
  expect(s.roots).toEqual([a, b]);
});
