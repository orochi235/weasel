import type { PickView } from './SceneCanvas/useSceneSelectTool';

/** The hit record returned by a `getNodeAtPoint` function. */
export interface NodeAtPointHit {
  id: string;
  kind: string;
}

/** Resolves a node's routing kind. */
export type NodeResolver = (id: string) => { kind: string } | null;

/** The node a single-hit picker names under a world point, with its kind:
 *  `'unknown'` when `nodeResolver` is absent or returns null. */
export function makeGetNodeAtPoint(
  pickBest: (wx: number, wy: number, view?: PickView | null) => string | null,
  nodeResolver?: NodeResolver,
): (wx: number, wy: number, view?: PickView | null) => NodeAtPointHit | null {
  return (wx: number, wy: number, view?: PickView | null): NodeAtPointHit | null => {
    const id = pickBest(wx, wy, view);
    if (id == null) return null;

    return { id, kind: nodeResolver?.(id)?.kind ?? 'unknown' };
  };
}
