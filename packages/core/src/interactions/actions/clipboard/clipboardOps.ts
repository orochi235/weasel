import { useCallback } from 'react';
import { useLatest } from '@weasel-js/react';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { InsertAdapter, PasteOmission } from 'core/adapters/types';
import type { ClipboardSnapshot } from './types';
import type { WorldPoint } from '@weasel-js/routing';
import { materializePaste } from './materializePaste';
import type { ClipboardFlavors } from './osClipboard';
import { useClipboard } from './useClipboard';

type Replacer = (key: string, value: unknown) => unknown;

export type { ClipboardFlavors } from './osClipboard';

/** Options for `useClipboardOps`. */
export interface UseClipboardOpsOptions {
  /** How the hook reads "current selection" for copy. The kit doesn't assume
   *  a global selection store; each consumer wires this. */
  getSelection: () => NodeId[];
  /** Called after a successful paste with the ids of the newly inserted objects. */
  onPaste?: (newIds: NodeId[]) => void;
  /** Called when a paste left copied nodes out, with each one and the reason
   *  — an edge whose endpoints were not copied with it, say. Also called for
   *  a paste that made nothing. */
  onPasteOmitted?: (omitted: PasteOmission[]) => void;
  /** Label for the history entry produced by paste. Default 'Paste'. */
  pasteLabel?: string;
  /** Pulled once per paste() call. When non-null, threaded to commitPaste
   *  as `ctx.dropPoint`; adapters typically use it as the cluster origin
   *  (ignoring `offset`). When null/undefined, the hook falls back to the
   *  existing cascade-offset behavior. */
  getDropPoint?: () => WorldPoint | null;
  /** Produce the OS-clipboard flavor map for a copied snapshot. Keys are MIME
   *  types, values the serialized payload. The kit default emits
   *  `application/x-weasel-clipboard+json` plus `text/plain` carrying the
   *  same JSON. Apps override to add richer flavors (e.g. real SVG) or to
   *  replace the text flavor. Return an empty object to skip the OS write
   *  entirely. A value may be a promise — an SVG flavor waiting on
   *  `warmSvg`, say: the write is still issued inside the copy gesture and
   *  the clipboard takes the text when it resolves. The producer itself runs
   *  synchronously, so it reads the selection as it stood at the copy. */
  produceFlavors?: (snapshot: ClipboardSnapshot) => ClipboardFlavors;
  /** Replacer for the kit-default JSON flavor (typed arrays etc.). Ignored
   *  when `produceFlavors` is supplied. */
  jsonReplacer?: Replacer;
}

/** Return shape of `useClipboardOps`: imperative `copy`, `paste`, and `isEmpty` functions. */
export interface UseClipboardOpsReturn {
  copy(): void;
  /** Paste at `at` when given; otherwise at the drop point, else the cascade offset. */
  paste(at?: WorldPoint): void;
  isEmpty(): boolean;
}

/** `useClipboard` over `InsertAdapter.snapshotSelection` / `commitPaste`, each paste one undoable op batch. */
export function useClipboardOps<TNode extends { id: string }>(
  adapter: InsertAdapter<TNode>,
  options: UseClipboardOpsOptions,
): UseClipboardOpsReturn {
  const { getSelection, onPaste, onPasteOmitted, pasteLabel = 'Paste', getDropPoint, produceFlavors, jsonReplacer } = options;
  const live = useLatest({ adapter, getSelection, onPasteOmitted, pasteLabel });
  const copy = useCallback((ids: readonly string[]) => {
    const snap = live.current.adapter.snapshotSelection;
    return snap ? snap.call(live.current.adapter, [...ids]).items : null;
  }, [live]);
  const paste = useCallback((items: readonly unknown[], at: { dropPoint?: WorldPoint }) => {
    const { adapter: a, getSelection: selected, onPasteOmitted: omitted, pasteLabel: label } = live.current;
    const result = materializePaste(a, { items: [...items] }, {
      currentSelection: selected(),
      dropPoint: at.dropPoint,
      onOmitted: omitted,
    });
    if (!result) return null;
    dispatchApplyBatch(a, result.ops, label);
    // A snapshot captures roots in world, as a copy does; a created node's pose is local to the page or container
    // it landed in. A React-state adapter has not flushed the insert yet, and its empty snapshot falls back.
    const again = a.snapshotSelection?.call(a, [...result.newIds]).items ?? [];
    return { ids: result.newIds, items: again.length > 0 ? again : result.created };
  }, [live]);
  return useClipboard<unknown>({
    getSelection,
    copy,
    paste,
    ...(onPaste ? { onPaste: (ids: string[]) => onPaste(ids as NodeId[]) } : {}),
    ...(getDropPoint ? { getDropPoint } : {}),
    ...(produceFlavors ? { produceFlavors: ({ items }) => produceFlavors({ items: [...items] }) } : {}),
    ...(jsonReplacer ? { jsonReplacer } : {}),
  });
}
