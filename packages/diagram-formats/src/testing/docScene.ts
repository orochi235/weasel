import { addOnPages, createPageRun, createScene, isPageStructure, type RectPose, type Scene } from '@weasel-js/core';
import {
  DIAGRAM_THEMES, DIAGRAM_THEME_KEY, diagramScene, withDiagramRegistry, type DiagramData, type MeasureRowText,
} from '@weasel-js/diagram';
import { addDocumentScene, type DocumentScene } from '../toScene';

/** The scene the document tests read. */
export type DocScene = Scene<unknown, string, RectPose>;

export const THEME = DIAGRAM_THEMES.night!;

/** Every glyph 7 wide and every line 16 tall, so sizes are the same wherever the tests run. */
export const MEASURE: MeasureRowText = (text) => ({ width: text.length * 7, height: 16 });

/** Two 1000 by 700 pages, 40 apart: the second starts at x 1040. */
export const PAGES = [{ id: 'p1', width: 1000, height: 700 }, { id: 'p2', name: 'Second', width: 1000, height: 700 }];

/**
 * Page 1: a stadium `a` in the accent role, a diamond `b` with a fill of its own, and `m` in
 * container `k`; `a` to `b` is labeled and bends at a waypoint. Page 2: `c`, and a pool `p`
 * of two lanes with `d` in the first. `a` to `c` crosses pages.
 */
export const DOC_DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: ['Start'], outline: 'stadium', at: { x: 40, y: 40 }, style: 'accent' },
    { id: 'b', lines: ['Check'], outline: 'diamond', at: { x: 40, y: 240 }, colors: { fill: '#123456' } },
    { id: 'm', lines: ['Inside'], at: { x: 320, y: 90 } },
    { id: 'c', lines: ['Far'], outline: 'ellipse', at: { x: 1100, y: 60 } },
    { id: 'd', lines: ['Lane'], at: { x: 1160, y: 330 } },
  ],
  edges: [
    { id: 'ab', from: 'a', to: 'b', label: 'yes', router: 'orthogonal', waypoints: [{ x: 200, y: 160 }] },
    { id: 'bm', from: 'b', to: 'm', router: 'straight' },
    { id: 'ac', from: 'a', to: 'c', router: 'bezier', label: 'away' },
  ],
  containers: [
    { id: 'k', role: 'container', label: 'Box', members: ['m'], box: { x: 300, y: 40, width: 220, height: 140 } },
    {
      id: 'p', role: 'pool', label: 'Pool', axis: 'y', box: { x: 1080, y: 300, width: 400, height: 240 },
      lanes: [{ id: 'l1', label: 'One', members: ['d'] }, { id: 'l2', label: 'Two' }],
    },
  ],
};

/** Options for {@link pagedDocScene} and {@link docScene}. */
export interface PagedOptions { pages?: typeof PAGES; doc?: Record<string, unknown>; pasteboard?: boolean }

/** A scene of `specs`, placed in world space, on `pages`: each root moved onto the page holding it, or with the
 *  pasteboard on left off every page it is off. Not an undo step. */
export function pagedDocScene(specs: readonly unknown[], { pages = PAGES, doc = {}, pasteboard }: PagedOptions = {}): DocScene {
  const scene = createScene<unknown, string, RectPose>({
    systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(), doc: { [DIAGRAM_THEME_KEY]: THEME.id, ...doc },
  });
  scene.untracked(() => scene.batch('Load', () => {
    createPageRun(scene, pages, pasteboard ? { pasteboard } : {});
    addOnPages(scene, specs as never);
  }));
  return scene;
}

/** A scene of what `documentSpecs` drew (`addDocumentScene`), not as an undo step. */
export function drawnScene(drawn: DocumentScene<string>): DocScene {
  const scene = createScene<unknown, string, RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
  scene.untracked(() => addDocumentScene(scene, drawn));
  return scene;
}

/** Every node but the page run and the pages, in render order. */
export const contentNodes = (scene: DocScene) => scene.renderOrderNodes().filter((n) => !isPageStructure(n));

/** A scene built from `data` in `THEME`, on two pages. */
export function docScene(data: DiagramData = DOC_DATA, opts: PagedOptions = {}): DocScene {
  return pagedDocScene(diagramScene(data, { layout: 'none', theme: THEME, measure: MEASURE }), opts);
}
