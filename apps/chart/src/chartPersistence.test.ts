import { describe, expect, it } from 'vitest';
import { PAGES_DOC_KEY, commitOps, createScene, pagesOf, type ActionDeps } from '@weasel-js/core';
import { DIAGRAM_THEME_KEY, DIAGRAM_THEMES, EDGE_DERIVE_PATH, FLOWCHART_STENCILS, applyDiagramTheme, stencilBuild } from '@weasel-js/diagram';
import { CHART_LAYERS, CHART_PAGE, CHART_REGISTRY, type ChartData, type ChartLayer, type ChartPose } from './chartDocument';
import { chartFromJson, chartToJson, replaceChart } from './chartPersistence';

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
    for (const spec of chartFromJson(chartToJson(scene)).specs) loaded.add(spec);
    expect(shape(loaded)).toEqual(shape(scene));
    const back = loaded.get(edge);
    expect(back?.dependsOn).toEqual(ids);
    expect(back?.data.diagram).toMatchObject({ from: {}, to: {} });
  });

  it('opens a chart saved before pages as one page of the chart page size', () => {
    const { scene } = twoBodiesAndAnEdge();
    const old = JSON.parse(chartToJson(scene)) as Record<string, unknown>;
    delete old.doc;
    expect(chartFromJson(JSON.stringify(old)).doc[PAGES_DOC_KEY]).toEqual({
      pages: [{ id: 'page-1', width: CHART_PAGE.width, height: CHART_PAGE.height }],
    });
  });

  it('saves and loads the page list', () => {
    const { scene } = twoBodiesAndAnEdge();
    const pages = { pages: [{ id: 'p', name: 'Cover', width: 816, height: 1056 }, { id: 'q', width: 100, height: 100 }] };
    scene.doc.set(PAGES_DOC_KEY, pages);
    expect(chartFromJson(chartToJson(scene)).doc[PAGES_DOC_KEY]).toEqual(pages);
  });

  it('saves and loads the theme, and the colors it wrote', () => {
    const { scene, ids } = twoBodiesAndAnEdge();
    applyDiagramTheme(scene, DIAGRAM_THEMES.night!);
    const loaded = chartFromJson(chartToJson(scene));
    expect(loaded.doc[DIAGRAM_THEME_KEY]).toEqual(scene.doc.get(DIAGRAM_THEME_KEY));
    const fill = loaded.specs.find((s) => s.id === ids[0])?.data.fill?.paint.color;
    expect(fill).toBe(DIAGRAM_THEMES.night!.roles.default!.fill);
  });

  it('replaces the nodes and the document values as one undo entry', () => {
    const { scene } = twoBodiesAndAnEdge();
    scene.doc.set('stale', 1);
    const pages = { pages: [{ id: 'p', width: 10, height: 10 }] };
    const before = scene.historyIndex();
    replaceChart(scene, { specs: [], doc: { [PAGES_DOC_KEY]: pages } }, 'Open chart');
    expect(scene.nodes.size).toBe(0);
    expect(pagesOf(scene)).toEqual(pages);
    expect(scene.doc.keys()).toEqual([PAGES_DOC_KEY]);
    expect(scene.historyIndex()).toBe(before + 1);
    scene.undo();
    expect(scene.doc.get('stale')).toBe(1);
    expect(scene.nodes.size).toBeGreaterThan(0);
  });

  it('rejects text that is not a saved chart', () => {
    expect(() => chartFromJson('{"hello":1}')).toThrow();
  });
});
