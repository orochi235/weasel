/** A paged scene for tests: two pages side by side on `paper`, and a rect `r` on page `a` on `ink`,
 *  overhanging its right edge into the gap. */
import { createScene } from '../scene/scene';
import { asNodeId, type RectPose } from '../scene/types';
import { createPageRun } from './pageNodes';

/** The left page. */
export const PAGE_A = asNodeId('a');
/** The right page. */
export const PAGE_B = asNodeId('b');
/** The rect on page `a`, overhanging its right edge. */
export const ON_PAGE = asNodeId('r');

/** The paged scene and its page run; `pasteboard` is handed to the run. */
export function pagedScene(options: { pasteboard?: boolean } = {}) {
  const scene = createScene<object, 'paper' | 'ink', RectPose>({ systemLayers: [{ id: 'paper' }, { id: 'ink' }] });
  const run = createPageRun(scene, [{ id: PAGE_A, width: 100, height: 50 }, { id: PAGE_B, width: 100, height: 50 }], {
    direction: 'row', gap: 10, ...options,
  });
  scene.add({ id: ON_PAGE, kind: 'mark', layer: 'ink', parent: PAGE_A, pose: { x: 90, y: 10, width: 20, height: 10 }, data: {} });
  return { scene, run };
}
