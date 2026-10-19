import { describe, expect, it } from 'vitest';
import { commitOps, createScene, type ActionDeps } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, FLOWCHART_STENCILS, stencilBuild } from '@weasel-js/diagram';
import { CHART_LAYERS, CHART_REGISTRY, type ChartData, type ChartLayer, type ChartPose } from './chartDocument';
import { chartFromJson, chartToJson } from './chartPersistence';

const newScene = () => createScene<ChartData, ChartLayer, ChartPose>({ systemLayers: CHART_LAYERS, registry: CHART_REGISTRY });

function twoBodiesAndAnEdge() {
  const scene = newScene();
  const [process, decision] = FLOWCHART_STENCILS;
  const ids = [
    { stencil: process!, at: { x: 100, y: 100, width: 0, height: 0 } },
    { stencil: decision!, at: { x: 400, y: 100, width: 0, height: 0 } },
  ].map(({ stencil, at }) => {
    const built = stencilBuild(stencil, at, { layer: 'shapes', newId: () => scene.mintId() });
    commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
    return built.id;
  });
  const edge = scene.add({
    kind: 'leaf',
    layer: 'shapes',
    pose: { x: 0, y: 0, width: 0, height: 0 },
    data: { diagram: { from: {}, to: {}, router: 'orthogonal' }, stroke: { paint: { color: '#7ba7c7' }, width: 2 } },
    dependsOn: ids as never,
    derivePath: EDGE_DERIVE_PATH as never,
  });
  return { scene, ids, edge };
}

const shape = (scene: ReturnType<typeof newScene>) =>
  scene.toJSON().nodes.map(({ id, kind, parent, data, dependsOn, derivePathKey }) => ({
    id, kind, parent, data, dependsOn, derivePathKey,
  }));

describe('chart persistence', () => {
  it('loads a saved chart back to the same nodes, dependencies and edge ends', () => {
    const { scene, ids, edge } = twoBodiesAndAnEdge();
    const loaded = newScene();
    for (const spec of chartFromJson(chartToJson(scene))) loaded.add(spec);
    expect(shape(loaded)).toEqual(shape(scene));
    const back = loaded.get(edge);
    expect(back?.dependsOn).toEqual(ids);
    expect(back?.data.diagram).toMatchObject({ from: {}, to: {} });
  });

  it('rejects text that is not a saved chart', () => {
    expect(() => chartFromJson('{"hello":1}')).toThrow();
  });
});
