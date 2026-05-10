import { useCallback, useEffect, useRef } from 'react';
import { createDeleteOp } from '../../../core/ops/delete';
import { createSetSelectionOp } from '../../../core/ops/select';
import type { Op } from '../../../core/ops/types';
import type { NodeId } from '../../../core/scene/types';
import { dispatchApplyBatch } from '../../../core/applyOps';
import type { InsertAdapter } from '../../../core/adapters/types';
import { useKeybinding } from '../useKeybinding';
import { useActionsRegistry, type Action } from '../registry';
import { useClipboardOps, type UseClipboardOpsReturn } from './clipboardOps';

/** Adapter for `useClipboard`. Extends `InsertAdapter` with the lookup
 *  needed by `cut` (capture the object so the resulting `DeleteOp` can invert
 *  back to an `InsertOp`). `removeObject` is also required so `DeleteOp.apply`
 *  can take effect against the same adapter. */
export interface ClipboardAdapter<TObject extends { id: string }>
  extends InsertAdapter<TObject> {
  /** Capture the full object for `cut` so undo can re-insert it intact. If
   *  omitted, `cut` falls back to a stub `{ id }` — undo will only restore the
   *  id, not the original object payload. */
  getObject?(id: string): TObject | undefined;
  /** Mutator wired by `DeleteOp.apply`. Required for `cut` to actually remove
   *  the originals. */
  removeObject(id: string): void;
}

/** Options for `useClipboard`. */
export interface UseClipboardOptions {
  /** Reads the current selection. Used by all three operations. */
  getSelection: () => NodeId[];
  /** Auto-bind Mod+C / Mod+X / Mod+V on document and register
   *  `clipboard.copy` / `clipboard.cut` / `clipboard.paste` actions into any
   *  surrounding `<ActionsProvider>`. Default true. */
  enableKeyboard?: boolean;
  /** Label for the cut batch. Default 'Cut'. */
  cutLabel?: string;
  /** Label for the paste batch. Default 'Paste'. */
  pasteLabel?: string;
  /** Called after a successful paste with the ids of the new objects. */
  onPaste?: (newIds: NodeId[]) => void;
}

/** Return shape of `useClipboard`. */
export interface UseClipboardReturn extends UseClipboardOpsReturn {
  /** Snapshot the selection into the clipboard, then delete the originals.
   *  Returns the ids that were cut (= the selection at call time), or `[]` on
   *  empty selection. */
  cut(): NodeId[];
}

/** Selection-driven copy / cut / paste with Mod+C, Mod+X, Mod+V keyboard
 *  bindings. Wraps `useClipboardOps` (logic-only) with the action-level
 *  ergonomics shared by `useDelete`, `useEscape`, etc.: registers three
 *  actions (`clipboard.copy`, `clipboard.cut`, `clipboard.paste`) into a
 *  surrounding `<ActionsProvider>` when one is in scope, or falls back to
 *  document keydown listeners when not. */
export function useClipboard<TObject extends { id: string }>(
  adapter: ClipboardAdapter<TObject>,
  options: UseClipboardOptions,
): UseClipboardReturn {
  const cb = useClipboardOps(adapter, {
    getSelection: options.getSelection,
    onPaste: options.onPaste,
    pasteLabel: options.pasteLabel,
  });

  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const cut = useCallback((): NodeId[] => {
    const ids = optsRef.current.getSelection();
    if (ids.length === 0) return [];
    // Snapshot first — the adapter's `snapshotSelection` reads live scene
    // state, so it must run before the originals are removed.
    cb.copy();
    const a = adapterRef.current;
    const ops: Op[] = ids.map((id) => {
      const obj = a.getObject?.(id) ?? ({ id } as unknown as TObject);
      return createDeleteOp({ object: obj });
    });
    ops.push(createSetSelectionOp({ from: ids, to: [] }));
    dispatchApplyBatch(a, ops, optsRef.current.cutLabel ?? 'Cut');
    return ids;
  }, [cb]);

  const reg = useActionsRegistry();
  const enableKeyboard = options.enableKeyboard ?? true;

  useEffect(() => {
    if (!reg || !enableKeyboard) return;
    const actions: Action[] = [
      {
        id: 'clipboard.copy',
        label: 'Copy',
        defaultBinding: { key: 'c', mod: true },
        run: () => { cb.copy(); },
      },
      {
        id: 'clipboard.cut',
        label: 'Cut',
        defaultBinding: { key: 'x', mod: true },
        run: () => { cut(); },
      },
      {
        id: 'clipboard.paste',
        label: 'Paste',
        defaultBinding: { key: 'v', mod: true },
        run: () => { cb.paste(); },
      },
    ];
    const unregs = actions.map((a) => reg.register(a));
    return () => { for (const u of unregs) u(); };
  }, [reg, enableKeyboard, cb, cut]);

  const fallback = enableKeyboard && reg == null;
  useKeybinding({ key: 'c', mod: true, enabled: fallback }, () => { cb.copy(); });
  useKeybinding({ key: 'x', mod: true, enabled: fallback }, () => { cut(); });
  useKeybinding({ key: 'v', mod: true, enabled: fallback }, () => { cb.paste(); });

  return { copy: cb.copy, cut, paste: cb.paste, isEmpty: cb.isEmpty };
}
