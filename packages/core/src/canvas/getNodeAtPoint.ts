/**
 * Stable helper for synthesizing the dispatcher's `getNodeAtPoint` callback
 * from a `pickEvery` function and an optional per-id node resolver.
 *
 * Extracted from `Canvas.tsx`'s inline `__setGetNodeAtPoint` synthesizer so
 * that `SceneCanvas` (and any other scene-aware wrapper) can build the
 * function externally and hand it to `<Canvas>` as a prop. The caller supplies
 * a `nodeResolver` that derives each hit's kind/pose/data (SceneCanvas
 * classifies the node's `data` via its routing registry).
 */

import type { PickCamera } from './SceneCanvas/useSceneSelectTool';

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
 * Algorithm matches the inline synthesizer in Canvas.tsx exactly:
 * - `pickEvery` returns `string | string[] | null`
 * - When an array, the **first** element is the topmost id (front-to-back order)
 * - `nodeResolver` is called for the topmost id to get kind/pose/data
 * - When `nodeResolver` is absent or returns null, kind defaults to `'unknown'`,
 *   pose to `undefined`, data to `{ id }`
 *
 * @param pickEvery  Raw hit-test function. Same signature as the Canvas prop.
 * @param nodeResolver  Optional per-id resolver. SceneCanvas builds this from its adapter.
 */
export function makeGetNodeAtPoint(
  pickEvery: (wx: number, wy: number, camera?: PickCamera | null) => string | string[] | null,
  nodeResolver?: NodeResolver,
): (wx: number, wy: number, camera?: PickCamera | null) => NodeAtPointHit | null {
  return (wx: number, wy: number, camera?: PickCamera | null): NodeAtPointHit | null => {
    const raw = pickEvery(wx, wy, camera);
    // Normalize `string | string[] | null` to topmost id (first entry).
    const id = Array.isArray(raw) ? raw[0] ?? null : raw;
    if (id == null) return null;

    const resolved = nodeResolver?.(id) ?? null;
    const kind = resolved?.kind ?? 'unknown';
    const pose = resolved?.pose;
    const data = resolved?.data ?? { id };

    return { id, kind, pose, data };
  };
}
