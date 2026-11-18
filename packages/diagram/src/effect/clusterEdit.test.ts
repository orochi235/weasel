import { describe, expect, it } from 'vitest';
import { removeStages } from './edit';
import { clusterStages, moveCluster, moveToCluster, nextClusterId, renameCluster, setClusterBox, dissolveCluster } from './clusterEdit';
import type { EffectDoc, EffectStage } from './types';

const stage = (id: string): EffectStage => ({ id, title: id, inputs: [{ id: 'in', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] });
const wire = (id: string, from: string, to: string) => ({ id, from: { stage: from, port: 'out' }, to: { stage: to, port: 'in' } });

const DOC: EffectDoc = {
  pipeline: {
    stages: ['a', 'b', 'c', 'd'].map(stage),
    wires: [wire('w1', 'a', 'b'), wire('w2', 'b', 'c'), wire('w3', 'c', 'd')],
    clusters: [{ id: 'outer', label: 'Outer', members: ['a', 'inner'] }, { id: 'inner', members: ['b', 'c'] }],
  },
  places: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, c: { x: 200, y: 0 }, d: { x: 300, y: 0 } },
};

const clusters = (d: EffectDoc) => d.pipeline.clusters ?? [];
const cluster = (d: EffectDoc, id: string) => clusters(d).find((g) => g.id === id);

describe('clusterStages', () => {
  it('clusters a cluster named beside its own member, the member staying inside it', () => {
    const doc: EffectDoc = { ...DOC, pipeline: { ...DOC.pipeline, clusters: [{ id: 'G', members: ['a'] }] } };
    const next = clusterStages(doc, ['G', 'a']);
    const id = nextClusterId(doc.pipeline);
    expect(cluster(next, 'G')!.members).toEqual(['a']);
    expect(cluster(next, id)!.members).toEqual(['G']);
  });

  it('nests a new cluster inside the cluster all its stages share, where the first one was', () => {
    const next = clusterStages(DOC, ['b', 'c'], 'Pair');
    const id = nextClusterId(DOC.pipeline);
    expect(cluster(next, id)).toEqual({ id, label: 'Pair', members: ['b', 'c'] });
    expect(cluster(next, 'inner')!.members).toEqual([id]);
  });

  it('puts a cluster of stages from different clusters at the top level, taking them out of their clusters', () => {
    const next = clusterStages(DOC, ['a', 'd']);
    const id = nextClusterId(DOC.pipeline);
    expect(cluster(next, id)).toEqual({ id, members: ['a', 'd'] });
    expect(cluster(next, 'outer')!.members).toEqual(['inner']);
  });

  it('mints an id no stage or cluster has', () => {
    const taken: EffectDoc = { ...DOC, pipeline: { ...DOC.pipeline, stages: [...DOC.pipeline.stages, stage('cluster')] } };
    expect(nextClusterId(taken.pipeline)).toBe('cluster-2');
  });

  it('makes nothing of no stages', () => {
    expect(clusterStages(DOC, [])).toBe(DOC);
  });
});

describe('dissolveCluster', () => {
  it('hands the members to its parent cluster, in its place, and drops its box', () => {
    const boxed = setClusterBox(DOC, 'inner', { x: 90, y: -10, width: 220, height: 80 });
    const next = dissolveCluster(boxed, 'inner');
    expect(cluster(next, 'inner')).toBeUndefined();
    expect(cluster(next, 'outer')!.members).toEqual(['a', 'b', 'c']);
    expect(next.clusterBoxes).toBeUndefined();
  });

  it('leaves the members of a top-level cluster at the top level', () => {
    const next = dissolveCluster(DOC, 'outer');
    expect(clusters(next).map((g) => g.id)).toEqual(['inner']);
  });
});

describe('renameCluster', () => {
  it('sets the label, and an empty one removes it', () => {
    expect(cluster(renameCluster(DOC, 'inner', 'Middle'), 'inner')!.label).toBe('Middle');
    expect(cluster(renameCluster(DOC, 'outer', ''), 'outer')).toEqual({ id: 'outer', members: ['a', 'inner'] });
  });
});

describe('moveToCluster', () => {
  it('moves a cluster named beside its own member, still holding it', () => {
    const doc: EffectDoc = { ...DOC, pipeline: { ...DOC.pipeline, clusters: [{ id: 'G', members: ['a'] }, { id: 'H', members: ['b'] }] } };
    for (const to of ['H', null]) {
      const next = moveToCluster(doc, ['G', 'a'], to);
      expect(cluster(next, 'G')!.members).toEqual(['a']);
      if (to !== null) expect(cluster(next, 'H')!.members).toEqual(['b', 'G']);
    }
  });

  it('moves stages into a cluster, out of the one they were in', () => {
    const next = moveToCluster(DOC, ['d'], 'inner');
    expect(cluster(next, 'inner')!.members).toEqual(['b', 'c', 'd']);
    const out = moveToCluster(next, ['b'], null);
    expect(cluster(out, 'inner')!.members).toEqual(['c', 'd']);
  });

  it('prunes a cluster left empty unless it has a box of its own', () => {
    const emptied = moveToCluster(DOC, ['b', 'c'], null);
    expect(cluster(emptied, 'inner')).toBeUndefined();
    expect(cluster(emptied, 'outer')!.members).toEqual(['a']);
    const boxed = setClusterBox(DOC, 'inner', { x: 0, y: 0, width: 10, height: 10 });
    expect(cluster(moveToCluster(boxed, ['b', 'c'], null), 'inner')!.members).toEqual([]);
  });

  it('refuses to put a cluster inside itself or an unknown cluster', () => {
    expect(moveToCluster(DOC, ['outer'], 'inner')).toBe(DOC);
    expect(moveToCluster(DOC, ['d'], 'nope')).toBe(DOC);
  });
});

describe('moveCluster', () => {
  it('moves member places, nested boxes, and the routes of wires inside, by one offset', () => {
    const doc: EffectDoc = {
      ...setClusterBox(DOC, 'inner', { x: 90, y: -10, width: 220, height: 80 }),
      routes: { w2: [{ x: 150, y: 40 }], w3: [{ x: 250, y: 40 }] },
    };
    const next = moveCluster(doc, 'outer', { x: 10, y: 20 });
    expect(next.places).toEqual({ a: { x: 10, y: 20 }, b: { x: 110, y: 20 }, c: { x: 210, y: 20 }, d: { x: 300, y: 0 } });
    expect(next.clusterBoxes).toEqual({ inner: { x: 100, y: 10, width: 220, height: 80 } });
    expect(next.routes).toEqual({ w2: [{ x: 160, y: 60 }], w3: [{ x: 250, y: 40 }] });
  });
});

describe('removeStages', () => {
  it('drops the box of a cluster it leaves empty', () => {
    const boxed = setClusterBox(DOC, 'inner', { x: 0, y: 0, width: 10, height: 10 });
    const next = removeStages(boxed, ['b', 'c']);
    expect(cluster(next, 'inner')).toBeUndefined();
    expect(next.clusterBoxes).toBeUndefined();
  });
});
