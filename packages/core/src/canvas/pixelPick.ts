/**
 * Picks read from what a canvas painted (`geometry.picking: 'pixels'`): the
 * nodes whose paint lands near a point, custom shaders and effects included,
 * from the canvas's id frames rather than node outlines.
 */
import type { IdBuffer } from '@weasel-js/renderer';
import type { CanvasIdReadOptions } from './canvasExtension';
import type { ScenePickIds } from './scenePickIds';

/** Id frames one pick draws at most. Each leaves out every node the ones
 *  before it found, so this bounds how deep a stack a pick can see. */
export const MAX_PIXEL_PICK_PASSES = 64;

type ReadIds = (
  rect: { x: number; y: number; width: number; height: number },
  options?: CanvasIdReadOptions,
) => IdBuffer | null;

/**
 * Every node painted within `radius` CSS pixels (along each axis) of the
 * screen point, back-to-front by `orderOf`, or `null` when the canvas has no
 * painted frame to read, or cannot read one at once (WebGPU). Each pass reads the square around the point with
 * every node found so far left out, until one finds nothing new, so nodes
 * covered by others are found as well: a caller can skip the topmost ones
 * and still get what is beneath them.
 */
export function pixelPickEvery(
  readIds: ReadIds,
  ids: ScenePickIds,
  screen: { x: number; y: number },
  radius: number,
  orderOf: (id: string) => number,
): string[] | null {
  const r = Math.max(0, radius);
  const rect = { x: screen.x - r, y: screen.y - r, width: 2 * r, height: 2 * r };
  const exclude = new Set<number>();
  const found: string[] = [];
  for (let pass = 0; pass < MAX_PIXEL_PICK_PASSES; pass++) {
    const buf = readIds(rect, exclude.size > 0 ? { exclude } : undefined);
    if (!buf || buf.width === 0 || buf.height === 0) return pass === 0 ? null : found;
    let fresh = false;
    for (const pickId of buf.data) {
      if (pickId === 0 || exclude.has(pickId)) continue;
      exclude.add(pickId);
      fresh = true;
      const node = ids.nodeOf(pickId);
      if (node !== null) found.push(node);
    }
    if (!fresh) break;
  }
  return found.sort((a, b) => orderOf(a) - orderOf(b));
}
