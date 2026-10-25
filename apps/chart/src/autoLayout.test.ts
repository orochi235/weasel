import { describe, expect, it } from 'vitest';
import { commitOps, createScene, type ActionDeps } from '@weasel-js/core';
import {
  EDGE_DERIVE_PATH, FLOWCHART_STENCILS, FLOWCHART_TYPE, MIND_MAP_STENCILS, MIND_MAP_TYPE, ORG_CHART_TYPE, ORG_STENCILS,
  sceneParticipants, stencilBuild, type DiagramStencil, type DiagramType,
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

const stencil = (list: readonly DiagramStencil[], id: string) => list.find((s) => s.id === id)!;

/** Shapes all dropped at one spot and joined parent to child, for a layout to sort out. */
function sketch(shapes: Record<string, DiagramStencil>, edges: readonly (readonly [string, string])[]) {
  const scene = createScene<ChartData, ChartLayer, ChartPose>({ systemLayers: CHART_LAYERS, registry: CHART_REGISTRY });
  const ids: Record<string, string> = {};
  for (const [name, s] of Object.entries(shapes)) {
    const built = stencilBuild(s, { x: 200, y: 200, width: 0, height: 0 }, { layer: 'shapes', newId: () => scene.mintId() });
    commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
    ids[name] = built.id;
  }
  for (const [from, to] of edges) {
    scene.add({
      kind: 'mark', layer: 'shapes', pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { diagram: { from: {}, to: {}, router: 'straight' }, stroke: { paint: { color: '#000' }, width: 2 } },
      dependsOn: [ids[from], ids[to]] as never, derivePath: EDGE_DERIVE_PATH as never,
    });
  }
  const box = (name: string) => scene.get(ids[name] as never)!.pose;
  return { scene, box, participants: sceneParticipants<ChartPose>(scene) };
}

describe('autoLayout', () => {
  it('stacks an org chart top-down, each manager above the people reporting to them', () => {
    const person = stencil(ORG_STENCILS, 'person');
    const { scene, box, participants } = sketch(
      { ceo: stencil(ORG_STENCILS, 'executive'), cto: person, cfo: person, dev: person },
      [['ceo', 'cto'], ['ceo', 'cfo'], ['cto', 'dev']],
    );
    expect(autoLayout(scene, ORG_CHART_TYPE, participants)).toBeGreaterThan(0);
    const bottom = (name: string) => box(name).y + box(name).height;
    expect(box('cto').y).toBeGreaterThan(bottom('ceo'));
    expect(box('cfo').y).toBeGreaterThan(bottom('ceo'));
    expect(box('dev').y).toBeGreaterThan(bottom('cto'));
  });

  it('spreads a mind map to both sides of its central topic', () => {
    const main = stencil(MIND_MAP_STENCILS, 'main-topic');
    const { scene, box, participants } = sketch(
      { hub: stencil(MIND_MAP_STENCILS, 'central-topic'), a: main, b: main, c: main, d: main },
      [['hub', 'a'], ['hub', 'b'], ['hub', 'c'], ['hub', 'd']],
    );
    expect(autoLayout(scene, MIND_MAP_TYPE, participants)).toBeGreaterThan(0);
    const hub = box('hub');
    const right = ['a', 'b', 'c', 'd'].filter((n) => box(n).x >= hub.x + hub.width);
    const left = ['a', 'b', 'c', 'd'].filter((n) => box(n).x + box(n).width <= hub.x);
    expect(right).toHaveLength(2);
    expect(left).toHaveLength(2);
  });

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
