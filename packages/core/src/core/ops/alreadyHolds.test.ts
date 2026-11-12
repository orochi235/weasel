import { describe, expect, it } from 'vitest';
import { makeScene, POSE } from 'core/scene/testing/makeScene';
import { sceneMutators } from 'core/scene/sceneMutators';
import type { Op } from './types';
import { createSetHiddenOp, createSetLockedOp } from './nodeFlags';
import { createSetLayerOp } from './setLayer';
import { createSetDataOp } from './setData';
import { createTransformOp } from './transform';
import { createSetDependsOnOp } from './setDependsOn';

function oneNode() {
  const s = makeScene();
  const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
  return { s, id, adapter: sceneMutators(s) };
}

describe('an op writing what the node already holds', () => {
  const cases: Record<string, (id: string) => Op> = {
    setHidden: (id) => createSetHiddenOp({ id, from: true, to: false }),
    setLocked: (id) => createSetLockedOp({ id, from: true, to: false }),
    setLayer: (id) => createSetLayerOp({ id, from: 'plantings', to: 'structures' }),
    setData: (id) => createSetDataOp({ id, from: { label: 'x' }, to: { label: 'a' } }),
    transform: (id) => createTransformOp({ id, from: { ...POSE, x: 3 }, to: { ...POSE } }),
    setDependsOn: (id) => createSetDependsOnOp({ id, from: ['q'], to: undefined }),
  };
  for (const [name, make] of Object.entries(cases)) {
    it(`records no entry: ${name}`, () => {
      const { s, id, adapter } = oneNode();
      const before = s.historyEntries().length;
      s.applyBatch([make(id)], name, adapter);
      expect(s.historyEntries()).toHaveLength(before);
    });
  }

  it('still records one that changes the node, and undoes it', () => {
    const { s, id, adapter } = oneNode();
    const before = s.historyEntries().length;
    s.applyBatch([createSetHiddenOp({ id, from: false, to: true })], 'Hide', adapter);
    expect(s.historyEntries()).toHaveLength(before + 1);
    s.undo();
    expect(s.get(id)?.hidden).toBeFalsy();
  });

  it('records a transform whose stated from and to agree but the node is elsewhere', () => {
    const { s, id, adapter } = oneNode();
    const before = s.historyEntries().length;
    const to = { ...POSE, x: 40 };
    s.applyBatch([createTransformOp({ id, from: to, to })], 'Move', adapter);
    expect(s.get(id)?.pose).toEqual(to);
    expect(s.historyEntries()).toHaveLength(before + 1);
    s.undo();
    expect(s.get(id)?.pose).toEqual(POSE);
  });
});
