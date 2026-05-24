import type { Scene, SerializedScene } from 'core/scene/types';
import type { View } from 'core/viewport/view';

/** Refs the hook reads from. All are "current value" getters so the
 *  hook always sees the latest state, never a stale closure. */
export interface TestHookRefs {
  getScene: () => Scene<unknown, string, unknown> | null;
  getSelectionIds: () => readonly string[];
  getView: () => View;
  getActiveToolId: () => string | null;
}

export interface WeaselTestHook {
  /** Resolves once SceneCanvas has rendered at least once. */
  readonly ready: Promise<void>;
  /** Snapshot of the current scene. Throws if scene not yet mounted. */
  getScene(): SerializedScene<unknown, string, unknown>;
  /** Ids of currently selected nodes (empty array if none). */
  getSelection(): string[];
  /** Current view: { x, y, scale: { x, y } }. */
  getView(): View;
  /** Active tool id, or null if no tool is active. */
  getActiveToolId(): string | null;
  /** Read a demo-registered probe value. Returns undefined if no probe with that name is registered. */
  probe<T = unknown>(name: string): T | undefined;
  /** Register a probe. Returns a disposer that unregisters it. */
  registerProbe<T>(name: string, fn: () => T): () => void;
  /** Internal: SceneCanvas calls this after first render. */
  _markReady(): void;
}

declare global {
  interface Window {
    __weaselTest?: WeaselTestHook;
  }
}
