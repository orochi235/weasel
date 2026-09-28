import { useActionsRegistry } from '@weasel-js/core';
import { createContext, useContext, useEffect } from 'react';
import type { CameraView } from './CameraInput';

/**
 * Cameras by key, for chrome that acts on a camera it does not contain — the
 * lab's zoom controls, which drive whichever trial has the focus.
 */
export interface CameraRegistry {
  /** Publish `camera` under `key` and return its release. Registrants for one
   *  key stack, newest live. */
  register(key: string, camera: CameraView): () => void;
  get(key: string): CameraView | null;
  /** Fires after any register or release. Shaped for `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void;
}

/** An empty in-memory `CameraRegistry`. */
export function createCameraRegistry(): CameraRegistry {
  const stacks = new Map<string, CameraView[]>();
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const l of listeners) l();
  };
  return {
    register(key, camera) {
      const stack = stacks.get(key) ?? [];
      stack.push(camera);
      stacks.set(key, stack);
      notify();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const cur = stacks.get(key);
        const i = cur?.lastIndexOf(camera) ?? -1;
        if (!cur || i === -1) return;
        cur.splice(i, 1);
        if (cur.length === 0) stacks.delete(key);
        notify();
      };
    },
    get: (key) => stacks.get(key)?.at(-1) ?? null,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The registry a lab keeps its trials' cameras in. */
export const CameraRegistryContext = createContext<CameraRegistry | null>(null);

/** Where a camera publishes itself. The host binds the key — a trial provides
 *  one that registers under its own id — so the camera needs no name. */
export const CameraPublishContext = createContext<((camera: CameraView) => () => void) | null>(
  null,
);

/** Publish `camera` to the host in scope for as long as the caller is mounted,
 *  and again each time its input scope becomes the active one — a registry
 *  key stacks newest-live, so the camera last used is the one chrome reaches.
 *  Call it inside the camera's scope. */
export function usePublishCamera(camera: CameraView): void {
  const publish = useContext(CameraPublishContext);
  const actions = useActionsRegistry();
  useEffect(() => {
    if (!publish) return;
    let release = publish(camera);
    if (!actions) return release;
    let was = actions.isActive();
    const off = actions.subscribe(() => {
      const now = actions.isActive();
      if (now && !was) {
        release();
        release = publish(camera);
      }
      was = now;
    });
    return () => {
      off();
      release();
    };
  }, [publish, camera, actions]);
}
