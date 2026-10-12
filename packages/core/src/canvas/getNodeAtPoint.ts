/**
 * Synthesizes the dispatcher's `getNodeAtPoint` callback from a single-hit
 * picker and an optional per-id node resolver, so `SceneCanvas` can build the
 * function and hand it to `<Canvas>` as a prop.
 */

import type { PickView } from './SceneCanvas/useSceneSelectTool';

/** The hit record returned by a `getNodeAtPoint` function. */
export interface NodeAtPointHit {
  id: string;
  kind: string;
  pose: unknown;
  data: unknown;
  meta?: Record<string, unknown>;
}

/**
 * Resolves per-id metadata for a node (kind, pose, data). When absent,
 * kind falls back to `'unknown'` and pose/data fall back to trivial values.
 */
export type NodeResolver = (id: string) => { kind: string; pose: unknown; data: unknown } | null;

/**
 * Build a `getNodeAtPoint(wx, wy)` function for `Canvas`'s `getNodeAtPoint`
 * prop. When `nodeResolver` is absent or returns null, kind defaults to
 * `'unknown'`, pose to `undefined`, and data to `{ id }`.
 */
export function makeGetNodeAtPoint(
  pickBest: (wx: number, wy: number, view?: PickView | null) => string | null,
  nodeResolver?: NodeResolver,
): (wx: number, wy: number, view?: PickView | null) => NodeAtPointHit | null {
  return (wx: number, wy: number, view?: PickView | null): NodeAtPointHit | null => {
    const id = pickBest(wx, wy, view);
    if (id == null) return null;

    const resolved = nodeResolver?.(id) ?? null;
    const kind = resolved?.kind ?? 'unknown';
    const pose = resolved?.pose;
    const data = resolved?.data ?? { id };

    return { id, kind, pose, data };
  };
}
