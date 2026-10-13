import type { MoveAdapter } from 'core/adapters/types';

interface Pose { x: number; y: number; width: number; height: number }

/** The least an adapter can be for the select tool: a fixed list of rects, bottom first,
 *  each its own pose. No hierarchy, no layers, no hit-test of its own. */
export function rectListAdapter<TRect extends { id: string } & Pose>(
  rects: readonly TRect[],
): MoveAdapter<TRect, Pose> {
  const find = (id: string): TRect | undefined => rects.find((r) => r.id === id);
  return {
    getNode: find,
    getNodes: () => [...rects],
    getPose: (id) => {
      const r = find(id);
      if (!r) throw new Error(`rectListAdapter: unknown node "${id}"`);
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    },
    setPose: () => {},
  };
}
