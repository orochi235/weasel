/** A paged scene for tests: two pages side by side on `paper`, and a rect `r` on page `a` on `ink`,
 *  overhanging its right edge into the gap. */
import { createScene } from '../scene/scene';
import { asNodeId, type RectPose } from '../scene/types';
import { createPageRun } from './pageNodes';

export const PAGE_A = asNodeId('a');
export const PAGE_B = asNodeId('b');
export const ON_PAGE = asNodeId('r');

export function pagedScene() {
  const scene = createScene<object, 'paper' | 'ink', RectPose>({ systemLayers: [{ id: 'paper' }, { id: 'ink' }] });
  const run = createPageRun(scene, [{ id: PAGE_A, width: 100, height: 50 }, { id: PAGE_B, width: 100, height: 50 }], {
    direction: 'row', gap: 10,
  });
  scene.add({ id: ON_PAGE, kind: 'mark', layer: 'ink', parent: PAGE_A, pose: { x: 90, y: 10, width: 20, height: 10 }, data: {} });
  return { scene, run };
}
