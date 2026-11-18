import { describe, expect, it } from 'vitest';
import { createScene, sceneFromJSON, type RectPose, type SerializedScene } from '@weasel-js/core';
import { DIAGRAM_CLUSTER } from './clusterBox';
import { upgradeClusterNames } from './clusterUpgrade';
import { withDiagramRegistry } from './edge';
import { diagramScene, type DiagramData } from './fromData';

type Save = SerializedScene<unknown, 'main', RectPose>;

const DATA: DiagramData = {
  nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }, { id: 'x', lines: ['outside'] }],
  edges: [{ from: 'a', to: 'b' }, { from: 'x', to: 'G' }],
  clusters: [{ id: 'G', members: ['a', 'b'], label: 'the cluster', reorder: 'y' }],
};

function newSave(): Save {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }], initial: diagramScene(DATA) as never, registry: withDiagramRegistry(),
  });
  return scene.toJSON();
}

/** `save` as a scene written before the rename held it. */
function oldSave(save: Save): Save {
  const nodes = save.nodes.map((n) => {
    const trait = (n.data as { diagram?: Record<string, unknown> }).diagram;
    if (trait === undefined || !Object.hasOwn(trait, 'cluster')) return n;
    const { cluster, ...rest } = trait;
    return {
      ...n,
      data: { ...(n.data as object), diagram: { ...rest, group: cluster } },
      ...(n.derivePoseKey === DIAGRAM_CLUSTER ? { derivePoseKey: 'diagram:group' } : {}),
    };
  });
  return { ...save, nodes };
}

const load = (save: Save) => sceneFromJSON<unknown, 'main', RectPose>(save, { registry: withDiagramRegistry() }).toJSON();

describe('loading a diagram saved under the old cluster names', () => {
  it('gives the scene a new save of it gives', () => {
    const current = newSave();
    const old = oldSave(current);
    expect(JSON.stringify(old)).toContain('"derivePoseKey":"diagram:group"');
    expect(JSON.stringify(old)).toContain('"group":{');
    expect(load(old)).toEqual(load(current));
    expect(load(old)).toEqual(current);
  });

  it('loads an old save in place through loadState', () => {
    const current = newSave();
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
    scene.loadState(oldSave(current));
    expect(scene.toJSON()).toEqual(current);
  });

  it('leaves a node in the current names as it is', () => {
    for (const n of newSave().nodes) expect(upgradeClusterNames(n)).toBe(n);
  });
});
