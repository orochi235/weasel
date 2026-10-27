/**
 * PointerContext — the world-space position of the canvas pointer, and the
 * view it is over, refreshed on every `pointermove` and cleared on
 * `pointerleave`.
 *
 * It is an external store rather than React state, so a consumer that only
 * reads on demand (paste at the pointer) does not re-render on every move.
 * Readers that need to follow it subscribe, or use `usePointerPosition()`.
 *
 * `<SceneCanvas>` publishes automatically, and defers to a provider already in
 * scope, so several surfaces under one provider share one pointer.
 */
import { createEmitter } from '@weasel-js/registry';
import {
  createContext, useContext, useState, useSyncExternalStore, type ReactNode,
} from 'react';
import type { WorldPoint } from '../interactions/actions/invoker';

/** The pointer's position in the space `clientToWorld` maps into, and the
 *  view it is over — a view id, or `null` for a surface's own camera. `null`
 *  as a whole when the pointer is over no publishing surface. */
export type PointerWorldPos = { world: WorldPoint; viewId: string | null } | null;

/** A pointer store: the latest position, a way to publish one, and change notification. */
export interface PointerContextValue {
  /** The latest position. */
  get(): PointerWorldPos;
  /** Publish a position. Subscribers hear only a changed value. */
  set(next: PointerWorldPos): void;
  /** Called after every change; returns the unsubscribe. */
  subscribe(fn: () => void): () => void;
  /** Bumps on every change. */
  getVersion(): number;
  /** `get()` as a stable thunk. */
  readonly getDropPoint: () => PointerWorldPos;
}

function samePos(a: PointerWorldPos, b: PointerWorldPos): boolean {
  if (a === null || b === null) return a === b;
  return a.world.x === b.world.x && a.world.y === b.world.y && a.viewId === b.viewId;
}

/** A pointer store with no provider around it. */
export function createPointerStore(): PointerContextValue {
  let current: PointerWorldPos = null;
  let version = 0;
  const changed = createEmitter();
  const get = (): PointerWorldPos => current;
  return {
    get,
    set(next) {
      if (samePos(current, next)) return;
      current = next;
      version++;
      changed.emit();
    },
    subscribe: changed.subscribe,
    getVersion: () => version,
    getDropPoint: get,
  };
}

const PointerContext = createContext<PointerContextValue | null>(null);

/**
 * Wrap the part of the React tree that should share one pointer.
 * `<SceneCanvas>` mounts one when none is in scope, so mount it yourself only
 * when two surfaces should share a pointer. Pass `store` to publish into one
 * you hold elsewhere (`createPointerStore()`).
 */
export function PointerContextProvider(
  { children, store }: { children: ReactNode; store?: PointerContextValue },
): ReactNode {
  const [own] = useState(createPointerStore);
  return <PointerContext.Provider value={store ?? own}>{children}</PointerContext.Provider>;
}

/** The surrounding pointer store, or `null` when no provider is
 *  in scope. */
export function usePointerContext(): PointerContextValue | null {
  return useContext(PointerContext);
}

const noSubscribe = (): (() => void) => () => {};
const noPointer = (): PointerWorldPos => null;

/** The pointer, re-rendering the caller whenever it changes.
 *  `null` outside a provider. */
export function usePointerPosition(): PointerWorldPos {
  const store = usePointerContext();
  return useSyncExternalStore(
    store ? store.subscribe : noSubscribe,
    store ? store.get : noPointer,
    store ? store.get : noPointer,
  );
}
