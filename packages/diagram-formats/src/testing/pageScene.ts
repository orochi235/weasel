import { PAGES_DOC_KEY, createScene, placedPagesOf, type PlacedPage, type RectPose, type Scene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, installOffPageMarkers, withDiagramRegistry } from '@weasel-js/diagram';

/** The scene the export tests draw: two 200 by 100 pages, 40 apart. */
export type PageScene = Scene<unknown, 'main', RectPose>;

export const RED = '#ff0000';
export const GREEN = '#00ff00';
export const BLUE = '#0000ff';
export const INK = '#000000';
export const PAPER = '#fafafa';

const LOOK = { style: { fontFamily: 'sans-serif', fontSize: 10 }, fill: INK, background: PAPER };
const PAGES = { pages: [{ id: 'p1', width: 200, height: 100 }, { id: 'p2', width: 200, height: 100 }] };
const EDGE_STROKE = { paint: { color: INK }, width: 2, markerEnd: 'arrow' as const };

const body = (id: string, pose: RectPose, outline: string, color: string, kind: 'leaf' | 'container' = 'leaf') => ({
  id: id as never, kind, layer: 'main' as const, pose,
  data: { diagram: { outline }, fill: { paint: { color } }, stroke: { paint: { color: INK }, width: 1 } },
});

const connector = (id: string, from: string, to: string) => ({
  id: id as never, kind: 'leaf' as const, layer: 'main' as const, pose: { x: 0, y: 0, width: 0, height: 0 },
  data: { diagram: { from: {}, to: {} }, stroke: EDGE_STROKE },
  dependsOn: [from as never, to as never],
  derivePath: EDGE_DERIVE_PATH,
});

/**
 * Page 1 holds a red diamond `a` with a text row, and a green box `b` below it joined
 * to it; page 2 holds a blue box `c`, joined to `a` across the gap, so that
 * connector is split and tagged at both ends.
 */
export function pageScene(): { scene: PageScene; pages: readonly PlacedPage[] } {
  const scene: PageScene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withDiagramRegistry(),
    doc: { [PAGES_DOC_KEY]: PAGES },
    initial: [
      body('a', { x: 20, y: 20, width: 60, height: 40 }, 'diamond', RED, 'container'),
      {
        id: 'a/row' as never, kind: 'leaf', layer: 'main', parent: 'a' as never,
        pose: { x: 30, y: 30, width: 40, height: 20 },
        data: { text: 'Start', style: { fontFamily: 'sans-serif', fontSize: 10 }, fill: { paint: { color: INK } } },
      },
      body('b', { x: 100, y: 65, width: 40, height: 30 }, 'rect', GREEN),
      body('c', { x: 300, y: 30, width: 40, height: 30 }, 'rect', BLUE),
      connector('ab', 'a', 'b'),
      connector('ac', 'a', 'c'),
    ] as never,
  });
  installOffPageMarkers(scene, { look: () => LOOK });
  // The split happens in an edit's entry, so make one that reaches the connector.
  scene.setPose('c' as never, { x: 301, y: 30, width: 40, height: 30 });
  return { scene, pages: placedPagesOf(scene) };
}
