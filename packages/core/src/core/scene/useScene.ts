import { useRef, useSyncExternalStore } from 'react';
import { createScene } from './scene';
import type { NodeId, Scene, UseSceneOptions } from './types';
import { asNodeId } from './types';

/** Trivial-form options: a flat list of items, no layers, no parenting. The
 *  full `useScene` form is reachable any time by adding `systemLayers`.
 *
 *  `historyLimit` and `generateId` are accepted because they're orthogonal to
 *  the "what's in the scene" question. `ops` is intentionally omitted — if
 *  you need custom ops, your app state already lives outside the "flat list
 *  of rects" frame and you should reach for the full `UseSceneOptions`. */
export interface UseSceneTrivialOptions<TItem extends { id: string }> {
  items: readonly TItem[];
  historyLimit?: number;
  generateId?: () => NodeId;
  /** Re-render the host on every scene mutation. Default `true`. See
   *  {@link UseSceneOptions.subscribe}. */
  subscribe?: boolean;
}

/** A subscribe function that never notifies. `useSyncExternalStore` still runs
 *  (hooks are unconditional) but the host is never re-rendered by the store. */
const NEVER_SUBSCRIBE = () => () => {};

const DEFAULT_LAYER = 'default' as const;
type DefaultLayer = typeof DEFAULT_LAYER;

function isTrivialOptions<TItem extends { id: string }>(
  options: unknown,
): options is UseSceneTrivialOptions<TItem> {
  return (
    !!options
    && typeof options === 'object'
    && 'items' in (options as Record<string, unknown>)
    && !('systemLayers' in (options as Record<string, unknown>))
  );
}

/** React hook returning a kit-owned `Scene`. The Scene is constructed once
 *  per host component and tracked via `useSyncExternalStore`, so React re-
 *  renders on every Scene mutation (including undo/redo) unless
 *  `subscribe: false` opts out.
 *
 *  Two call shapes:
 *  - **Trivial**: `useScene({ items })` — one auto-registered system layer
 *    named `'default'`, each item added as a leaf with `pose === data === item`.
 *    Cheapest path for "a flat list of rects."
 *  - **Full**: `useScene({ systemLayers, initial?, ops?, ... })` — explicit
 *    layers, parenting, and custom op registration. */
export function useScene<TItem extends { id: string }>(
  options: UseSceneTrivialOptions<TItem>,
): Scene<TItem, DefaultLayer, TItem>;
/** The full call shape: explicit layers, initial nodes, custom ops, and
 *  history configuration. */
export function useScene<TData, TLayer extends string, TPose = import('../../features/groups/composePose').RectPose>(
  options: UseSceneOptions<TData, TLayer, TPose>,
): Scene<TData, TLayer, TPose>;
/** Create and subscribe to a scene. */
export function useScene(options: unknown): unknown {
  const sceneRef = useRef<Scene<unknown, string, unknown> | null>(null);
  if (sceneRef.current === null) {
    if (isTrivialOptions(options)) {
      const scene = createScene<unknown, DefaultLayer, unknown>({
        systemLayers: [{ id: DEFAULT_LAYER }],
        historyLimit: options.historyLimit,
        generateId: options.generateId,
        initial: options.items.map((item) => ({
          kind: 'leaf',
          layer: DEFAULT_LAYER,
          pose: item,
          data: item,
          id: asNodeId(item.id),
        })),
      });
      sceneRef.current = scene as Scene<unknown, string, unknown>;
    } else {
      sceneRef.current = createScene(
        options as UseSceneOptions<unknown, string, unknown>,
      ) as Scene<unknown, string, unknown>;
    }
  }
  const scene = sceneRef.current;
  const subscribed = (options as { subscribe?: boolean } | null)?.subscribe !== false;
  useSyncExternalStore(
    subscribed ? scene.subscribe : NEVER_SUBSCRIBE,
    scene.getVersion,
    scene.getVersion,
  );
  return scene;
}
