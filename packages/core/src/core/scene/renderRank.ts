/** Paint-order comparison over a scene, at constant cost per comparison. */
import type { Scene } from './types';

const ranks = new WeakMap<readonly { id: string }[], Map<string, number>>();

/** Each id's index in `order`, built once per cached render order. */
function rankOf(order: readonly { id: string }[]): Map<string, number> {
  let rank = ranks.get(order);
  if (!rank) {
    rank = new Map();
    for (let i = 0; i < order.length; i++) rank.set(order[i]!.id, i);
    ranks.set(order, rank);
  }
  return rank;
}

/**
 * A `compareZ` over `scene`'s paint order: negative when `a` paints below `b`.
 * An id the scene does not hold sorts below every one it does. It reads the
 * order the scene holds at each call, and ranks it once per structural edit,
 * so a sort over k ids costs O(n + k log k) rather than a scan per comparison.
 */
export function renderOrderCompare(
  scene: Pick<Scene<unknown, string, unknown>, 'renderOrderNodes'>,
): (a: string, b: string) => number {
  return (a, b) => {
    const rank = rankOf(scene.renderOrderNodes());
    return (rank.get(a) ?? -1) - (rank.get(b) ?? -1);
  };
}
