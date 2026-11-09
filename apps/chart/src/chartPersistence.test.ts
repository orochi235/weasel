import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSessionPersistence } from '@weasel-js/editor';
import { PAGES_DOC_KEY, commitOps, createScene, isPageStructure, pageRunOf, pagesOf, setPages, type ActionDeps, type NodeId } from '@weasel-js/core';
import {
  DIAGRAM_THEME_KEY, DIAGRAM_THEMES, DIAGRAM_TYPE_DOC_KEY, EDGE_DERIVE_PATH, FLOWCHART_STENCILS, applyDiagramTheme, diagramTypeDocOf,
  stencilBuild,
} from '@weasel-js/diagram';
import { CHART_LAYERS, CHART_PAGE, CHART_REGISTRY, type ChartData, type ChartLayer, type ChartPose } from './chartDocument';
import {
  CHART_HISTORY_KEY, CHART_SCENE_KEY, CHART_SESSION, chartFromJson, chartToJson, emptyChart, replaceChart,
  replaceChartWithDocument, type ChartFile,
} from './chartPersistence';

const newScene = () => createScene<ChartData, ChartLayer, ChartPose>({ systemLayers: CHART_LAYERS, registry: CHART_REGISTRY });
const sceneOf = (file: ChartFile) => createScene<ChartData, ChartLayer, ChartPose>({
  systemLayers: CHART_LAYERS, registry: CHART_REGISTRY, initial: file.specs, doc: file.doc,
});
/** `scene` saved and opened again. */
const reopened = (scene: ReturnType<typeof newScene>) => sceneOf(chartFromJson(chartToJson(scene)));

function twoBodiesAndAnEdge() {
  const scene = newScene();
  const [process, decision] = FLOWCHART_STENCILS;
  const ids = [
    { stencil: process!, at: { x: 100, y: 100, width: 0, height: 0 } },
    { stencil: decision!, at: { x: 400, y: 100, width: 0, height: 0 } },
  ].map(({ stencil, at }) => {
    const built = stencilBuild(stencil, at, { layer: 'shapes', newId: () => scene.mintId() });
    commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
    return built.id as NodeId;
  });
  const edge = scene.add({
    kind: 'mark',
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
    const { scene: unpaged, ids, edge } = twoBodiesAndAnEdge();
    const scene = reopened(unpaged);
    const loaded = reopened(scene);
    expect(shape(loaded)).toEqual(shape(scene));
    const back = loaded.get(edge);
    expect(back?.dependsOn).toEqual(ids);
    expect(back?.data.diagram).toMatchObject({ from: {}, to: {} });
  });

  it('opens a chart saved before pages as one page of the chart page size, its content on it', () => {
    const { scene, ids } = twoBodiesAndAnEdge();
    const old = JSON.parse(chartToJson(scene)) as Record<string, unknown>;
    delete old.doc;
    const loaded = sceneOf(chartFromJson(JSON.stringify(old)));
    expect(pagesOf(loaded)?.pages).toEqual([{ id: 'page-1', width: CHART_PAGE.width, height: CHART_PAGE.height }]);
    expect(ids.map((id) => loaded.get(id)?.parent)).toEqual(['page-1', 'page-1']);
  });

  it('opens a chart that kept its pages as a document value with page nodes, its content in their frames', () => {
    const { scene, ids, edge } = twoBodiesAndAnEdge();
    const pages = { pages: [{ id: 'p', name: 'Cover', width: 300, height: 300 }, { id: 'q', width: 300, height: 300 }] };
    scene.doc.set(PAGES_DOC_KEY, pages);
    const file = chartFromJson(chartToJson(scene));
    expect(PAGES_DOC_KEY in file.doc).toBe(false);
    const loaded = sceneOf(file);
    expect(pagesOf(loaded)?.pages).toEqual(pages.pages);
    const [onP, onQ] = ids.map((id) => loaded.get(id)!);
    expect([onP!.parent, onQ!.parent]).toEqual(['p', 'q']);
    // q sits at x 340 (300 wide, a 40 gap), so the body drawn at world x 400 is at 60 in q's frame.
    expect(onQ!.pose.x).toBeCloseTo(scene.get(ids[1]!)!.pose.x - 340);
    expect(onP!.pose.x).toBeCloseTo(scene.get(ids[0]!)!.pose.x);
    expect(loaded.get(edge)?.parent).toBe(pageRunOf(loaded));
  });

  it('loads a converted chart again unchanged', () => {
    const { scene } = twoBodiesAndAnEdge();
    scene.doc.set(PAGES_DOC_KEY, { pages: [{ id: 'p', width: 300, height: 300 }, { id: 'q', width: 300, height: 300 }] });
    const once = reopened(scene);
    expect(reopened(once).toJSON()).toEqual(once.toJSON());
  });

  it('saves and loads the page list', () => {
    const scene = reopened(twoBodiesAndAnEdge().scene);
    const pages = [{ id: 'page-1', name: 'Cover', width: 816, height: 1056 }, { id: 'q', width: 100, height: 100 }];
    setPages(scene, { pages }, 'Pages');
    expect(pagesOf(reopened(scene))?.pages).toEqual(pages);
  });

  it('saves and loads the theme, and the colors it wrote', () => {
    const { scene, ids } = twoBodiesAndAnEdge();
    applyDiagramTheme(scene, DIAGRAM_THEMES.night!);
    const loaded = chartFromJson(chartToJson(scene));
    expect(loaded.doc[DIAGRAM_THEME_KEY]).toEqual(scene.doc.get(DIAGRAM_THEME_KEY));
    const fill = loaded.specs.find((s) => s.id === ids[0])?.data.fill?.paint.color;
    expect(fill).toBe(DIAGRAM_THEMES.night!.roles.default!.fill);
  });

  it('replaces the nodes, the pages and the document values as one undo entry', () => {
    const scene = reopened(twoBodiesAndAnEdge().scene);
    scene.doc.set('stale', 1);
    const other = newScene();
    other.doc.set(PAGES_DOC_KEY, { pages: [{ id: 'p', width: 10, height: 10 }] });
    other.doc.set('kept', 2);
    const before = scene.historyIndex();
    replaceChart(scene, chartFromJson(chartToJson(other)), 'Open chart');
    expect([...scene.nodes.values()].every((n) => isPageStructure(n))).toBe(true);
    expect(pagesOf(scene)?.pages).toEqual([{ id: 'p', width: 10, height: 10 }]);
    expect(scene.doc.keys()).toEqual(['kept']);
    expect(scene.historyIndex()).toBe(before + 1);
    scene.undo();
    expect(scene.doc.get('stale')).toBe(1);
    expect(pagesOf(scene)?.pages.map((p) => p.id)).toEqual(['page-1']);
    expect(scene.nodes.size).toBeGreaterThan(2);
  });

  it('drops the undo stack saved beside a chart whose pages were not yet nodes, and keeps it beside one whose were', () => {
    const { scene } = twoBodiesAndAnEdge();
    /** The stack the session handed `restoreHistory`, or null for none. */
    const restored = (saved: string): unknown => {
      localStorage.setItem(CHART_SCENE_KEY, saved);
      localStorage.setItem(CHART_HISTORY_KEY, '{"version":1}');
      const target = newScene();
      const restore = vi.spyOn(target, 'restoreHistory').mockImplementation(() => {});
      renderHook(() => useSessionPersistence(target, CHART_SESSION)).unmount();
      return restore.mock.calls[0]?.[0] ?? null;
    };
    expect(restored(chartToJson(scene))).toBeNull();
    expect(restored(chartToJson(reopened(scene)))).toEqual({ version: 1 });
    localStorage.clear();
  });

  it('replaces the chart with a document as one undo entry, clearing what it lacks, on one page where it has none', () => {
    const scene = reopened(twoBodiesAndAnEdge().scene);
    setPages(scene, { pages: [{ id: 'old', width: 10, height: 10 }] }, 'Pages');
    scene.doc.set('stale', 1);
    const before = scene.historyIndex();
    replaceChartWithDocument(scene, { specs: [], pages: [], doc: { kept: 2 } }, 'Import');
    expect(scene.historyIndex()).toBe(before + 1);
    expect(scene.doc.keys()).toEqual(['kept']);
    expect(pagesOf(scene)?.pages).toEqual([{ id: 'page-1', width: CHART_PAGE.width, height: CHART_PAGE.height }]);
    expect([...scene.nodes.values()].every((n) => isPageStructure(n))).toBe(true);
    scene.undo();
    expect(scene.doc.get('stale')).toBe(1);
  });

  it('rejects text that is not a saved chart', () => {
    expect(() => chartFromJson('{"hello":1}')).toThrow();
  });

  it('reads a chart saved without a diagram type as a flowchart with its groups', () => {
    const { scene } = twoBodiesAndAnEdge();
    const file = chartFromJson(chartToJson(scene));
    expect(DIAGRAM_TYPE_DOC_KEY in file.doc).toBe(false);
    const loaded = newScene();
    replaceChart(loaded, file, 'Open');
    expect(diagramTypeDocOf(loaded)).toEqual({ type: 'flowchart', groups: ['flowchart', 'containers'] });
  });

  it('starts a new chart carrying its type on one page, and saves it', () => {
    const scene = newScene();
    replaceChart(scene, emptyChart('flowchart'), 'New chart');
    expect(pagesOf(scene)?.pages).toEqual([{ id: 'page-1', width: CHART_PAGE.width, height: CHART_PAGE.height }]);
    expect(scene.doc.get(DIAGRAM_TYPE_DOC_KEY)).toEqual({ type: 'flowchart', groups: ['flowchart', 'containers'] });
    expect(chartFromJson(chartToJson(scene)).doc[DIAGRAM_TYPE_DOC_KEY]).toEqual({ type: 'flowchart', groups: ['flowchart', 'containers'] });
  });
});
