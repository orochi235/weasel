/** The flat-list call shape `createScene` and `useScene` both take: `{ items }`. */
import { IDENTITY_POSE_COMPOSITION } from './composeFrame';
import type { UseSceneOptions } from './useSceneOptions';
import { asNodeId, type NodeId } from './types';

/** Trivial-form options: a flat list of items, no layers, no parenting. The
 *  full form is reachable any time by adding `systemLayers`.
 *
 *  `historyLimit` and `generateId` are accepted because they're orthogonal to
 *  the "what's in the scene" question. `ops` is intentionally omitted — if
 *  you need custom ops, your app state already lives outside the "flat list
 *  of rects" frame and you should reach for the full `UseSceneOptions`. */
export interface UseSceneTrivialOptions<TItem extends { id: string }> {
  items: readonly TItem[];
  historyLimit?: number;
  generateId?: () => NodeId;
  /** `useScene` only: re-render the host on every scene mutation. Default
   *  `true`. See {@link UseSceneOptions.subscribe}. */
  subscribe?: boolean;
}

const DEFAULT_LAYER = 'default' as const;
/** The one layer a trivial-form scene has. */
export type DefaultLayer = typeof DEFAULT_LAYER;

export function isTrivialOptions(options: unknown): options is UseSceneTrivialOptions<{ id: string }> {
  return (
    !!options
    && typeof options === 'object'
    && 'items' in (options as Record<string, unknown>)
    && !('systemLayers' in (options as Record<string, unknown>))
  );
}

/** The full options a flat list stands for: its items are whatever the caller holds, and nothing nests. */
export function trivialSceneOptions(
  options: UseSceneTrivialOptions<{ id: string }>,
): UseSceneOptions<unknown, DefaultLayer, unknown> {
  return {
    composition: IDENTITY_POSE_COMPOSITION,
    systemLayers: [{ id: DEFAULT_LAYER }],
    historyLimit: options.historyLimit,
    generateId: options.generateId,
    initial: options.items.map((item) => ({
      kind: 'mark',
      layer: DEFAULT_LAYER,
      pose: item,
      data: item,
      id: asNodeId(item.id),
    })),
  };
}
