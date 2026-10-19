/** How a scene tells its readers it changed. */
import type { Notifier } from './notifier';

export interface SceneChanges {
  /** Hear every change, a change of selection included. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Monotonically increasing version. Snapshot for `useSyncExternalStore`. */
  getVersion(): number;
  /** {@link SceneChanges.getVersion} less the changes that only moved the selection: unmoved
   *  across a notice that changed nothing else. */
  getContentVersion(): number;
}

/** A scene's change members, over its notifier and its selection's own count of changes. */
export function sceneChanges(notifier: Notifier, selection: { changes(): number }): SceneChanges {
  return {
    subscribe: notifier.subscribe,
    getVersion: notifier.version,
    getContentVersion: () => notifier.version() - selection.changes(),
  };
}
