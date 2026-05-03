import { useCallback, useRef } from 'react';
import { createDeleteOp } from '../../ops/delete';
import { createSetSelectionOp } from '../../ops/selection';
import type { Op } from '../../ops/types';
import type { InsertAdapter } from '../../adapters/types';
import { useKeybinding } from '../actions/useKeybinding';
import { useClipboard, type UseClipboardReturn } from './clipboard';

/** Adapter for `useClipboardAction`. Extends `InsertAdapter` with the lookup
 *  needed by `cut` (capture the object so the resulting `DeleteOp` can invert
 *  back to an `InsertOp`). `removeObject` is also required so `DeleteOp.apply`
 *  can take effect against the same adapter. */
export interface ClipboardActionAdapter<TObject extends { id: string }>
  extends InsertAdapter<TObject> {
  /** Capture the full object for `cut` so undo can re-insert it intact. If
   *  omitted, `cut` falls back to a stub `{ id }` — undo will only restore the
   *  id, not the original object payload. */
  getObject?(id: string): TObject | undefined;
  /** Mutator wired by `DeleteOp.apply`. Required for `cut` to actually remove
   *  the originals. */
  removeObject(id: string): void;
}

/** Options for `useClipboardAction`. */
export interface UseClipboardActionOptions {
  /** Reads the current selection. Used by all three operations. */
  getSelection: () => string[];
  /** Auto-bind Mod+C / Mod+X / Mod+V on document. Default false. */
  bindKeyboard?: boolean;
  /** Label for the cut batch. Default 'Cut'. */
  cutLabel?: string;
  /** Label for the paste batch. Default 'Paste'. */
  pasteLabel?: string;
  /** Called after a successful paste with the ids of the new objects. */
  onPaste?: (newIds: string[]) => void;
}

/** Return shape of `useClipboardAction`. */
export interface UseClipboardActionReturn extends UseClipboardReturn {
  /** Snapshot the selection into the clipboard, then delete the originals.
   *  Returns the ids that were cut (= the selection at call time), or `[]` on
   *  empty selection. */
  cut(): string[];
}

/** Selection-driven copy / cut / paste with optional Mod+C, Mod+X, Mod+V
 *  keyboard bindings. Wraps `useClipboard` (logic-only) with the action-level
 *  ergonomics shared by `useDeleteAction`, `useEscapeAction`, etc. */
export function useClipboardAction<TObject extends { id: string }>(
  adapter: ClipboardActionAdapter<TObject>,
  options: UseClipboardActionOptions,
): UseClipboardActionReturn {
  const cb = useClipboard(adapter, {
    getSelection: options.getSelection,
    onPaste: options.onPaste,
    pasteLabel: options.pasteLabel,
  });

  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const cut = useCallback((): string[] => {
    const ids = optsRef.current.getSelection();
    if (ids.length === 0) return [];
    // Snapshot first — the adapter's `snapshotSelection` reads live scene
    // state, so it must run before the originals are removed.
    cb.copy();
    const a = adapterRef.current;
    const ops: Op[] = ids.map((id) => {
      const obj = a.getObject?.(id) ?? ({ id } as TObject);
      return createDeleteOp({ object: obj });
    });
    ops.push(createSetSelectionOp({ from: ids, to: [] }));
    a.applyBatch(ops, optsRef.current.cutLabel ?? 'Cut');
    return ids;
  }, [cb]);

  const bind = !!options.bindKeyboard;
  useKeybinding({ key: 'c', mod: true, enabled: bind }, () => { cb.copy(); });
  useKeybinding({ key: 'x', mod: true, enabled: bind }, () => { cut(); });
  useKeybinding({ key: 'v', mod: true, enabled: bind }, () => { cb.paste(); });

  return { copy: cb.copy, cut, paste: cb.paste, isEmpty: cb.isEmpty };
}
