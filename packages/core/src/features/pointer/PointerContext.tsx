/**
 * @experimental
 * PointerContext — a tiny ambient context that publishes the world-space
 * position of the canvas pointer, refreshed on every `pointermove` over
 * the canvas. Cleared (set to `null`) on `pointerleave`.
 *
 * Why ref-based and not state-based: cursor moves fire dozens of times per
 * second; routing those through React state would re-render every consumer
 * in the tree. The context exposes a stable `pointerRef` whose `.current`
 * is mutated directly by the publisher, plus a thunk `getDropPoint()` that
 * reads it on demand. Consumers (e.g. `useClipboard`) pull via the thunk
 * inside their callbacks — no subscription, no re-render.
 *
 * `<SceneCanvas>` publishes automatically. `useClipboardOps` consumes when
 * the caller didn't pass an explicit `getDropPoint` option. Other future
 * hit-on-cursor consumers (drop-zone hover, context-menu anchor) can reuse
 * the same context.
 */
import { createContext, useContext, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';

/** @experimental World-space pointer position, or `null` when the pointer
 *  isn't over the publishing canvas. */
export type PointerWorldPos = { worldX: number; worldY: number } | null;

/** @experimental */
export interface PointerContextValue {
  /** Live ref — mutate to publish, read for the latest snapshot. The
   *  identity is stable for the lifetime of the provider. */
  readonly pointerRef: MutableRefObject<PointerWorldPos>;
  /** Convenience thunk equivalent to `() => pointerRef.current`. Stable
   *  identity for the lifetime of the provider; safe to pass to hooks. */
  readonly getDropPoint: () => PointerWorldPos;
}

const PointerContext = createContext<PointerContextValue | null>(null);

/**
 * @experimental
 * Wrap the part of the React tree that should share a pointer-position
 * context. Usually placed at the demo / app root, alongside
 * `<ActionsProvider>` and `<SelectionContextProvider>`.
 *
 * Most consumers don't need to mount this directly — `<SceneCanvas>` mounts
 * an internal provider when no parent provider is in scope, so child hooks
 * (`useClipboard` without an explicit `getDropPoint`) read the canvas's
 * tracked pointer for free.
 */
export function PointerContextProvider({ children }: { children: ReactNode }): ReactNode {
  const pointerRef = useRef<PointerWorldPos>(null);
  const value = useMemo<PointerContextValue>(() => ({
    pointerRef,
    getDropPoint: () => pointerRef.current,
  }), []);
  return <PointerContext.Provider value={value}>{children}</PointerContext.Provider>;
}

/** @experimental Read the surrounding pointer-context value, or `null` when
 *  no provider is in scope. */
export function usePointerContext(): PointerContextValue | null {
  return useContext(PointerContext);
}
