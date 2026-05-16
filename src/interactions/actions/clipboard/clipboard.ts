import { useCallback, useEffect, useRef } from 'react';
import { createDeleteOp } from 'core/ops/delete';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { InsertAdapter } from 'core/adapters/types';
import { useKeybinding } from '../useKeybinding';
import { useActionsRegistry, type Action } from '../registry';
import { useClipboardOps, type UseClipboardOpsReturn } from './clipboardOps';

/** Adapter for `useClipboard`. Extends `InsertAdapter` with the lookup
 *  needed by `cut` (capture the object so the resulting `DeleteOp` can invert
 *  back to an `InsertOp`). `removeNode` is also required so `DeleteOp.apply`
 *  can take effect against the same adapter. */
export interface ClipboardAdapter<TNode extends { id: string }>
  extends InsertAdapter<TNode> {
  /** Capture the full object for `cut` so undo can re-insert it intact. If
   *  omitted, `cut` falls back to a stub `{ id }` — undo will only restore the
   *  id, not the original object payload. */
  getNode?(id: string): TNode | undefined;
  /** Original z-index of `id` in the host array. Required by `cut` so the
   *  inverted re-insert restores paint order. Return `-1` if `id` isn't
   *  found. */
  getNodeIndex(id: string): number;
  /** Mutator wired by `DeleteOp.apply`. Required for `cut` to actually remove
   *  the originals. */
  removeNode(id: string): void;
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
  /** Pulled once per paste() call. When non-null, threaded to commitPaste
   *  as `ctx.dropPoint`. See useClipboardOps for full semantics. */
  getDropPoint?: () => { worldX: number; worldY: number } | null;
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
export function useClipboard<TNode extends { id: string }>(
  adapter: ClipboardAdapter<TNode>,
  options: UseClipboardOptions,
): UseClipboardReturn {
  const cb = useClipboardOps(adapter, {
    getSelection: options.getSelection,
    onPaste: options.onPaste,
    pasteLabel: options.pasteLabel,
    getDropPoint: options.getDropPoint,
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
    const captured: { obj: TNode; index: number }[] = [];
    for (const id of ids) {
      const index = a.getNodeIndex(id);
      if (index < 0) continue;
      const obj = a.getNode?.(id) ?? ({ id } as unknown as TNode);
      captured.push({ obj, index });
    }
    if (captured.length === 0) return [];
    // Order by index DESC so reverse-then-invert (history's undo path)
    // re-inserts ASC — each splice lands on a correctly-sized array
    // instead of clamping high indices to a still-growing length.
    captured.sort((a, b) => b.index - a.index);
    const ops: Op[] = captured.map(({ obj, index }) => createDeleteOp({ node: obj, index }));
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
