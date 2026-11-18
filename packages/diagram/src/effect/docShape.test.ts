import { describe, expect, it } from 'vitest';
import { readEffectDoc } from './docShape';
import type { EffectDoc } from './types';

const STAGES = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];
const CLUSTERS = [{ id: 'outer', label: 'Outer', members: ['inner'] }, { id: 'inner', members: ['a', 'b'] }];
const BOXES = { outer: { x: 0, y: 0, width: 300, height: 200 } };

const current: EffectDoc = { pipeline: { stages: STAGES, wires: [], clusters: CLUSTERS }, places: {}, clusterBoxes: BOXES };
const saved = { pipeline: { stages: STAGES, wires: [], groups: CLUSTERS }, places: {}, groupBoxes: BOXES };

describe('readEffectDoc with a doc saved under the old cluster names', () => {
  it('reads `groups` and `groupBoxes` as the clusters and boxes the new names give', () => {
    expect(readEffectDoc(JSON.parse(JSON.stringify(saved)))).toEqual(current);
  });

  it('writes what it read back under the new names only', () => {
    const text = JSON.stringify(readEffectDoc(JSON.parse(JSON.stringify(saved))));
    expect(text).not.toMatch(/"groups"|"groupBoxes"/);
    expect(JSON.parse(text)).toEqual(current);
  });

  it('keeps the new names where a doc has both, and drops the old', () => {
    const both = { ...saved, pipeline: { ...saved.pipeline, clusters: [] }, clusterBoxes: {} };
    const read = readEffectDoc(both);
    expect(read.pipeline.clusters).toEqual([]);
    expect(read.clusterBoxes).toEqual({});
    expect(JSON.stringify(read)).not.toMatch(/"groups"|"groupBoxes"/);
  });

  it('returns a doc already under the new names as itself', () => {
    expect(readEffectDoc(current)).toBe(current);
  });

  it('checks the renamed clusters like any others', () => {
    expect(() => readEffectDoc({ ...saved, pipeline: { ...saved.pipeline, groups: [{ id: 3, members: [] }] } }))
      .toThrow(expect.objectContaining({ path: 'doc.pipeline.clusters[0].id' }));
  });
});
