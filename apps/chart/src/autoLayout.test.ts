import { describe, expect, it } from 'vitest';
import { commitOps, createScene, type ActionDeps } from '@weasel-js/core';
import {
  EDGE_DERIVE_PATH, FLOWCHART_STENCILS, FLOWCHART_TYPE, sceneParticipants, stencilBuild, type DiagramType,
} from '@weasel-js/diagram';
import { autoLayout } from './autoLayout';
import { CHART_LAYERS, CHART_REGISTRY, type ChartData, type ChartLayer, type ChartPose } from './chartDocument';

const TREE: DiagramType = { id: 'tree-test', label: 'Tree', groups: ['flowchart'], layout: 'tree' };

/** Two shapes side by side, joined by a connector, so a tree layout stacks them. */
function joined() {
  const scene = createScene<ChartData, ChartLayer, ChartPose>({ systemLayers: CHART_LAYERS, registry: CHART_REGISTRY });
  const ids = [100, 400].map((x) => {
    const built = stencilBuild(FLOWCHART_STENCILS[0]!, { x, y: 100, width: 0, height: 0 }, { layer: 'shapes', newId: () => scene.mintId() });
    commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
    return built.id;
  });
  scene.add({
    kind: 'mark', layer: 'shapes', pose: { x: 0, y: 0, width: 0, height: 0 },
    data: { diagram: { from: {}, to: {}, router: 'straight' }, stroke: { paint: { color: '#000' }, width: 2 } },
    dependsOn: ids as never, derivePath: EDGE_DERIVE_PATH as never,
  });
  return { scene, ids, participants: sceneParticipants<ChartPose>(scene) };
}

describe('autoLayout', () => {
  it("runs the type's layout as one undo entry, which puts every shape back", () => {
    const { scene, ids, participants } = joined();
    const before = ids.map((id) => scene.get(id as never)!.pose);
    const depth = scene.historyIndex();
    expect(autoLayout(scene, TREE, participants)).toBeGreaterThan(0);
    expect(ids.map((id) => scene.get(id as never)!.pose)).not.toEqual(before);
    expect(scene.historyIndex()).toBe(depth + 1);
    scene.undo();
    expect(ids.map((id) => scene.get(id as never)!.pose)).toEqual(before);
  });

  it('does nothing for a type with no layout', () => {
    const { scene, participants } = joined();
    const depth = scene.historyIndex();
    expect(autoLayout(scene, FLOWCHART_TYPE, participants)).toBe(0);
    expect(scene.historyIndex()).toBe(depth);
  });
});
