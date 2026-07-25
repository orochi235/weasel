import { useCallback, useRef } from 'react';
import { createInsertOp } from 'core/ops/create';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { InsertAdapter } from 'core/adapters/types';
import type { ClipboardSnapshot } from './types';
import { usePointerContext } from 'features/pointer/PointerContext';
import { dwarn } from 'debug/flag';
import { WEASEL_CLIPBOARD_MIME, buildWeaselClipboardText } from './wireFormat';

type Replacer = (key: string, value: unknown) => unknown;

/** Options for `useClipboardOps`. */
export interface UseClipboardOpsOptions {
  /** How the hook reads "current selection" for copy. The kit doesn't assume
   *  a global selection store; each consumer wires this. */
  getSelection: () => NodeId[];
  /** Called after a successful paste with the ids of the newly inserted objects. */
  onPaste?: (newIds: NodeId[]) => void;
  /** Label for the history entry produced by paste. Default 'Paste'. */
  pasteLabel?: string;
  /** Pulled once per paste() call. When non-null, threaded to commitPaste
   *  as `ctx.dropPoint`; adapters typically use it as the cluster origin
   *  (ignoring `offset`). When null/undefined, the hook falls back to the
   *  existing cascade-offset behavior. */
  getDropPoint?: () => { worldX: number; worldY: number } | null;
  /** Produce the OS-clipboard flavor map for a copied snapshot. Keys are MIME
   *  types, values the serialized payload. The kit default emits
   *  `application/x-weasel-clipboard+json` plus `text/plain` carrying the
   *  same JSON. Apps override to add richer flavors (e.g. real SVG) or to
   *  replace the text flavor. Return an empty object to skip the OS write
   *  entirely. */
  produceFlavors?: (snapshot: ClipboardSnapshot) => Record<string, string>;
  /** Replacer for the kit-default JSON flavor (typed arrays etc.). Ignored
   *  when `produceFlavors` is supplied. */
  jsonReplacer?: Replacer;
}

/** Return shape of `useClipboardOps`: imperative `copy`, `paste`, and `isEmpty` functions. */
export interface UseClipboardOpsReturn {
  copy(): void;
  paste(): void;
  isEmpty(): boolean;
}

const EMPTY: ClipboardSnapshot = { items: [] };

/** In-memory copy/paste of selections via `InsertAdapter.snapshotSelection` / `commitPaste`. */
export function useClipboardOps<TNode extends { id: string }>(
  adapter: InsertAdapter<TNode>,
  options: UseClipboardOpsOptions,
): UseClipboardOpsReturn {
  const { getSelection, onPaste, pasteLabel = 'Paste', getDropPoint, produceFlavors, jsonReplacer } = options;
  // Fall back to the ambient pointer context (auto-published by SceneCanvas)
  // when the caller didn't supply an explicit `getDropPoint`. Null context
  // (no provider in scope) and no caller-supplied thunk together mean
  // "no drop point" — paste uses the cascade offset instead.
  const pointerCtx = usePointerContext();
  const effectiveGetDropPoint = getDropPoint ?? pointerCtx?.getDropPoint;
  const clipboardRef = useRef<ClipboardSnapshot>(EMPTY);
  // Keep callbacks stable across renders.
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef({
    getSelection, onPaste, pasteLabel, getDropPoint: effectiveGetDropPoint, produceFlavors, jsonReplacer,
  });
  optsRef.current = {
    getSelection, onPaste, pasteLabel, getDropPoint: effectiveGetDropPoint, produceFlavors, jsonReplacer,
  };

  const copy = useCallback(() => {
    const ids = optsRef.current.getSelection();
    if (ids.length === 0) return;
    const snap = adapterRef.current.snapshotSelection;
    if (!snap) return;
    clipboardRef.current = snap(ids);
    // Best-effort OS write. Never blocks or throws — the in-memory ref is
    // already set, and OS clipboard support varies (custom formats are
    // Chromium-only via the "web " prefix; jsdom/non-secure contexts have
    // no API at all). The flavor producer itself is untrusted consumer code
    // (`produceFlavors`), so guard its call too — a throwing producer must
    // not break `copy()`, it just skips the OS write.
    let flavors: Record<string, string> | null = null;
    try {
      flavors = optsRef.current.produceFlavors?.(clipboardRef.current)
        ?? defaultFlavors(clipboardRef.current, optsRef.current.jsonReplacer);
    } catch (err) {
      dwarn('clipboard', `flavor producer threw — skipping OS write: ${String(err)}`);
    }
    if (flavors) void writeOsClipboard(flavors);
  }, []);

  const paste = useCallback(() => {
    const cb = clipboardRef.current;
    if (cb.items.length === 0) return;
    const a = adapterRef.current;
    if (!a.commitPaste) return;
    const offset = a.getPasteOffset?.(cb) ?? { dx: 0, dy: 0 };
    const dropPoint = optsRef.current.getDropPoint?.();
    const ctx = dropPoint != null ? { dropPoint } : undefined;
    const created = a.commitPaste(cb, offset, ctx);
    if (created.length === 0) return;
    const newIds = created.map((o) => o.id as NodeId);
    const beforeSel = optsRef.current.getSelection();
    const ops: Op[] = [
      ...created.map((o) => createInsertOp({ node: o })),
      createSetSelectionOp({ from: beforeSel, to: newIds }),
    ];
    dispatchApplyBatch(a, ops, optsRef.current.pasteLabel);
    // Use the just-created objects as the next cascade source. Re-snapshotting
    // via `adapter.snapshotSelection(newIds)` would read adapter state, but
    // React-state adapters haven't flushed yet — `itemsRef.current` still
    // points at the pre-insert array, so the snapshot would come back empty
    // and the next paste would no-op.
    clipboardRef.current = { items: created };
    optsRef.current.onPaste?.(newIds);
  }, []);

  const isEmpty = useCallback(() => clipboardRef.current.items.length === 0, []);

  return { copy, paste, isEmpty };
}

function defaultFlavors(snapshot: ClipboardSnapshot, replacer?: Replacer): Record<string, string> {
  const text = buildWeaselClipboardText(snapshot.items, replacer);
  return { [WEASEL_CLIPBOARD_MIME]: text, 'text/plain': text };
}

/** MIME types the async Clipboard API accepts unprefixed. Every other type
 *  (including our own custom MIME, and app-supplied flavors like
 *  `image/svg+xml`) must carry Chromium's `web ` prefix or `ClipboardItem`'s
 *  constructor throws. */
const WELL_KNOWN_CLIPBOARD_MIMES = new Set(['text/plain', 'text/html', 'image/png']);

/** Degradation ladder: full map (every non-well-known MIME web-prefixed) →
 *  well-known-only → give up with a dwarn.
 *  @internal test seam — exported so unit tests can await the fire-and-forget
 *  write directly; tests should still exercise this at least once through
 *  the public `copy()` (see clipboardOps.test.tsx). */
export async function writeOsClipboard(flavors: Record<string, string>): Promise<void> {
  const entries = Object.entries(flavors);
  if (entries.length === 0) return;
  const cb = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!cb?.write || typeof ClipboardItem === 'undefined') return;
  const wireMime = (mime: string) => (WELL_KNOWN_CLIPBOARD_MIMES.has(mime) ? mime : `web ${mime}`);
  const toItem = (fs: [string, string][]) => new ClipboardItem(Object.fromEntries(
    fs.map(([mime, text]) => {
      const wire = wireMime(mime);
      return [wire, new Blob([text], { type: wire })];
    }),
  ));
  try {
    await cb.write([toItem(entries)]);
  } catch {
    const standard = entries.filter(([mime]) => WELL_KNOWN_CLIPBOARD_MIMES.has(mime));
    if (standard.length === 0) { dwarn('clipboard', 'OS write failed; no standard flavors to fall back to'); return; }
    try {
      await cb.write([toItem(standard)]);
    } catch (err) {
      dwarn('clipboard', `OS clipboard write failed twice — copy stays in-memory only: ${String(err)}`);
    }
  }
}
