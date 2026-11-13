import { useRef, useSyncExternalStore } from 'react';
import { createScene } from './scene';
import type { DefaultLayer, UseSceneTrivialOptions } from './trivialScene';
import type { Scene, UseSceneOptions } from './types';

export type { UseSceneTrivialOptions } from './trivialScene';

/** A subscribe function that never notifies. `useSyncExternalStore` still runs
 *  (hooks are unconditional) but the host is never re-rendered by the store. */
const NEVER_SUBSCRIBE = () => () => {};

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
export function useScene<TData, TLayer extends string, TPose = import('./composePose').RectPose>(
  options: UseSceneOptions<TData, TLayer, TPose>,
): Scene<TData, TLayer, TPose>;
/** Create and subscribe to a scene. */
export function useScene(options: unknown): unknown {
  const sceneRef = useRef<Scene<unknown, string, unknown> | null>(null);
  if (sceneRef.current === null) sceneRef.current = createScene(options as UseSceneOptions<unknown, string, unknown>);
  const scene = sceneRef.current;
  const subscribed = (options as { subscribe?: boolean } | null)?.subscribe !== false;
  useSyncExternalStore(
    subscribed ? scene.subscribe : NEVER_SUBSCRIBE,
    scene.getVersion,
    scene.getVersion,
  );
  return scene;
}
