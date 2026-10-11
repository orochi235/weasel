/**
 * Synthesizes the dispatcher's `getNodeAtPoint` callback from a single-hit
 * picker and an optional per-id node resolver, so `SceneCanvas` can build the
 * function and hand it to `<Canvas>` as a prop.
 */

import type { PickView } from './SceneCanvas/useSceneSelectTool';

/** The hit record returned by a `getNodeAtPoint` function.  Matches the
 *  shape expected by `ToolsDispatcher.__setGetNodeAtPoint`. */
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
 * Build a stable `getNodeAtPoint(wx, wy)` function suitable for passing to
 * the tool dispatcher via `Canvas`'s `getNodeAtPoint` prop.
 *
 * `nodeResolver` supplies the hit's kind/pose/data. When it is absent or
 * returns null, kind defaults to `'unknown'`, pose to `undefined`, and data to
 * `{ id }`.
 *
 * @param pickBest  Answers the one id under a world point. SceneCanvas passes
 *   the select tool's own resolution, so a click reports the node it selects.
 * @param nodeResolver  Optional per-id resolver. SceneCanvas builds this from its adapter.
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
