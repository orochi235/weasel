/**
 * @experimental
 * SelectionContext — a tiny ambient context that publishes "what's currently
 * selected" so non-canvas UI (command palette, status bar, breadcrumbs,
 * undo-label generation) can read it without threading a selection prop
 * through the tree.
 *
 * **Single-slot semantics (v1):** the context holds one selection array.
 * Whichever canvas (or other publisher) calls `publishSelection` most
 * recently owns the slot. For single-canvas pages — the typical case —
 * this Just Works. Multi-canvas pages get last-writer-wins, which is
 * approximately "most recently rendered." A v2 could become focus-aware
 * (canvas claims the slot on focus, releases on blur), but that's deferred
 * until a real multi-canvas use case lands.
 *
 * `<SceneCanvas>` calls `publishSelection` automatically when wrapped in a
 * `<SelectionContext>`. Bare-`<Canvas>` consumers opt in by calling
 * `useSelectionContext().publishSelection(ids)` themselves.
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

/** @experimental */
export interface SelectionContextValue {
  /** The most-recently-published selection. Empty array when no canvas
   *  has published or when the active canvas's selection is empty. */
  readonly selection: readonly string[];
  /** Optional per-id kind label, parallel to `selection`. Publishers that
   *  know their domain populate it (e.g. `'rectangle'`, `'path'`, `'group'`)
   *  so consumers can render type-aware copy. Sparse entries (`undefined`)
   *  are allowed; consumers should treat the kinds array as best-effort.
   *
   *  See `docs/TODO.md` (Tier 1.5 → "Typed scene-object references") for the
   *  longer-term direction toward a proper id+kind value type. */
  readonly kinds?: readonly (string | undefined)[];
  /** Publish the calling canvas's selection. Idempotent — calling with
   *  the same array (by content equality) does not trigger a re-render
   *  of the consumer tree. */
  publishSelection(ids: readonly string[], kinds?: readonly (string | undefined)[]): void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

/**
 * @experimental
 * Wrap the part of the React tree that should share a selection context.
 * Usually placed at the demo / app root, alongside `<ActionsProvider>`.
 */
export function SelectionContextProvider({ children }: { children: ReactNode }): ReactNode {
  const [state, setState] = useState<{
    selection: readonly string[];
    kinds: readonly (string | undefined)[] | undefined;
  }>({ selection: [], kinds: undefined });
  const lastSerializedRef = useRef<string>('');

  const publishSelection = useCallback((
    ids: readonly string[],
    kinds?: readonly (string | undefined)[],
  ): void => {
    // Cheap content equality via JSON serialization over both ids and kinds.
    // Selection arrays are typically small (≤ a few dozen entries); the cost
    // is dwarfed by avoiding a re-render when nothing changed.
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
 * Read the current selection-context value. Returns `null` when no
 * `<SelectionContextProvider>` is in scope; consumers should fall back
 * gracefully (e.g. command palette hides the "N selected" header).
 */
export function useSelectionContext(): SelectionContextValue | null {
  return useContext(SelectionContext);
}

/**
 * @experimental
 * Convenience hook for canvas components: publishes the supplied `ids`
 * into the surrounding `<SelectionContextProvider>` whenever the
 * content of `ids` changes. No-op when there's no provider in scope.
 *
 * Used by `<SceneCanvas>` internally to auto-publish; bare-Canvas
 * consumers call `useSelectionContext()` and `publishSelection` directly.
 */
export function usePublishSelection(
  ids: readonly string[],
  kinds?: readonly (string | undefined)[],
): void {
  const ctx = useContext(SelectionContext);
  // Track latest values via refs so the effect's deps array can use a stable
  // serialization — avoids re-firing on identity-only changes.
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const kindsRef = useRef(kinds);
  kindsRef.current = kinds;
  const serialized = JSON.stringify([ids, kinds]);
  useEffect(() => {
    if (!ctx) return;
    ctx.publishSelection(idsRef.current, kindsRef.current);
  }, [ctx, serialized]);
}
