/**
 * @experimental
 * SelectionContext — an ambient context that publishes "what's currently
 * selected" so non-canvas UI (command palette, status bar) can read it without
 * threading a selection prop through the tree.
 *
 * **Single slot:** the context holds one selection array. Whichever publisher
 * calls `publishSelection` most recently owns it, so a multi-canvas page gets
 * last-writer-wins. `<SceneCanvas>` publishes automatically.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLatest } from '@weasel-js/react';
import type { NodeId } from '../vocabulary';

/** @experimental */
export interface SelectionContextValue {
  /** The most-recently-published selection. Empty array when no canvas
   *  has published or when the active canvas's selection is empty. */
  readonly selection: readonly NodeId[];
  /** Optional per-id kind label, parallel to `selection` (e.g. `'rectangle'`,
   *  `'path'`, `'group'`). Sparse entries (`undefined`) are allowed; treat it
   *  as best-effort. */
  readonly kinds?: readonly (string | undefined)[];
  /** Publish the calling canvas's selection. Calling with the same content
   *  does not re-render the consumer tree. */
  publishSelection(ids: readonly NodeId[], kinds?: readonly (string | undefined)[]): void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

/**
 * @experimental
 * Wrap the part of the React tree that should share a selection context.
 * Usually placed at the demo / app root, alongside `<ActionsProvider>`.
 */
export function SelectionContextProvider({ children }: { children: ReactNode }): ReactNode {
  const [state, setState] = useState<{
    selection: readonly NodeId[];
    kinds: readonly (string | undefined)[] | undefined;
  }>({ selection: [], kinds: undefined });
  const lastSerializedRef = useRef<string>('');

  const publishSelection = useCallback((
    ids: readonly NodeId[],
    kinds?: readonly (string | undefined)[],
  ): void => {
    const next = JSON.stringify([ids, kinds]);
    if (next === lastSerializedRef.current) return;
    lastSerializedRef.current = next;
    setState({ selection: ids, kinds });
  }, []);

  const value = useMemo<SelectionContextValue>(
    () => ({
      selection: state.selection,
      ...(state.kinds !== undefined ? { kinds: state.kinds } : {}),
      publishSelection,
    }),
    [state, publishSelection],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

/**
 * @experimental
 * The current selection-context value, or `null` when no
 * `<SelectionContextProvider>` is in scope.
 */
export function useSelectionContext(): SelectionContextValue | null {
  return useContext(SelectionContext);
}

/**
 * @experimental
 * Mounts a `<SelectionContextProvider>` only when no parent provider is in
 * scope; otherwise renders children unwrapped.
 */
export function SelectionContextProviderIfRoot({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const parent = useContext(SelectionContext);
  if (parent !== null) return <>{children}</>;
  return <SelectionContextProvider>{children}</SelectionContextProvider>;
}

/**
 * @experimental
 * Publishes `ids` into the surrounding `<SelectionContextProvider>` whenever
 * their content changes, and clears the slot on unmount unless another
 * publisher has written it since. No-op when there's no provider in scope.
 */
export function usePublishSelection(
  ids: readonly NodeId[],
  kinds?: readonly (string | undefined)[],
): void {
  const ctx = useContext(SelectionContext);
  // Track latest values via refs so the effect's deps array can use a stable
  // serialization — avoids re-firing on identity-only changes.
  const idsRef = useLatest(ids);
  const kindsRef = useLatest(kinds);
  const serialized = JSON.stringify([ids, kinds]);
  // Depend on `publishSelection` rather than `ctx`: the provider mints a new
  // context value on every publish, so keying on `ctx` refires this effect for
  // every publisher whenever any one of them publishes.
  const publish = ctx?.publishSelection;
  useEffect(() => {
    if (!publish) return;
    publish(idsRef.current, kindsRef.current);
  }, [publish, serialized, idsRef, kindsRef]);
  // A publisher that goes away takes its selection with it, unless another
  // has written the slot since.
  const ctxRef = useLatest(ctx);
  const serializedRef = useLatest(serialized);
  useEffect(() => () => {
    const slot = ctxRef.current;
    if (slot && JSON.stringify([slot.selection, slot.kinds]) === serializedRef.current) {
      slot.publishSelection([]);
    }
  }, [ctxRef, serializedRef]);
}
