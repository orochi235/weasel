import {
  addOnPages, createPageRun, createScene, placedPagesOf, type PlacedPage, type RectPose, type Scene,
} from '@weasel-js/core';

/** The scene the export tests draw: two 200 by 100 pages, 40 apart, with no diagram in it. */
export type PlainScene = Scene<unknown, 'main' | 'notes', RectPose>;

export const RED = '#ff0000';
export const GREEN = '#00ff00';
export const BLUE = '#0000ff';
export const GRAY = '#808080';

const PAGES = [{ id: 'p1', width: 200, height: 100 }, { id: 'p2', width: 200, height: 100 }];
const solid = (color: string) => ({ paint: { kind: 'solid', color } });

/**
 * Page 1 holds a red rect `r` and a green ellipse `e`; page 2 a blue path `p`.
 * A gray rect `n` on page 1 sits on the annotation layer `notes`.
 */
export function plainScene(): { scene: PlainScene; pages: readonly PlacedPage[] } {
  const scene: PlainScene = createScene<unknown, 'main' | 'notes', RectPose>({
    systemLayers: [{ id: 'main' }, { id: 'notes', annotation: true }],
  });
  const initial = [
    { id: 'r', kind: 'mark', layer: 'main', pose: { x: 20, y: 20, width: 60, height: 40 }, data: { shape: 'rect', fill: solid(RED) } },
    { id: 'e', kind: 'mark', layer: 'main', pose: { x: 100, y: 30, width: 40, height: 30 }, data: { shape: 'ellipse', fill: solid(GREEN) } },
    {
      id: 'p', kind: 'mark', layer: 'main', pose: { x: 300, y: 30, width: 40, height: 30 },
      data: { path: { kind: 'rect', x: 300, y: 30, width: 40, height: 30 }, fill: solid(BLUE) },
    },
    { id: 'n', kind: 'mark', layer: 'notes', pose: { x: 150, y: 70, width: 20, height: 20 }, data: { shape: 'rect', fill: solid(GRAY) } },
  ];
  scene.untracked(() => scene.batch('Load', () => {
    createPageRun(scene, PAGES);
    addOnPages(scene, initial as never);
  }));
  return { scene, pages: placedPagesOf(scene) };
}
