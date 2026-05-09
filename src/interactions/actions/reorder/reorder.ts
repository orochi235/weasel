import { useCallback, useEffect, useRef } from 'react';
import { createReorderOp } from '../../../core/ops/reorder';
import type { Op } from '../../../core/ops/types';
import type { NodeId } from '../../../core/scene/types';
import { dispatchApplyBatch } from '../../../core/applyOps';
import { useKeybinding } from '../useKeybinding';
import { useActionsRegistry } from '../registry';
import { defaultReorderActions } from '../defaults/reorder';

/** Adapter for `useReorder`; both order methods optional and the hook no-ops when either is absent. */
export interface ReorderAdapter {
  getSelection(): NodeId[];
  getParent(id: string): string | null;
  /** Optional — when absent, every reorder method is a silent no-op. */
  getChildren?(parentId: string | null): string[];
  /** Optional — when absent, every reorder method is a silent no-op. */
  setChildOrder?(parentId: string | null, ids: string[]): void;
  /** Optional: op-batch entry point. When omitted, ops apply directly. */
  applyBatch?(ops: Op[], label: string): void;
}

/** Options for `useReorder`. */
export interface UseReorderOptions {
  /** Auto-bind Mod+] / Mod+[ (with optional Shift for to-front/to-back) on document. Default true. */
  enableKeyboard?: boolean;
  /** Optional filter — given selected ids, return the subset to reorder. */
  filter?: (ids: NodeId[]) => NodeId[];
}

/** Return shape of `useReorder`: imperative bring/send methods. */
export interface UseReorderReturn {
  bringForward(): void;
  sendBackward(): void;
  bringToFront(): void;
  sendToBack(): void;
}

/** Sibling z-order action; binds Mod+] / Mod+[ (forward/backward) and Shift-modified variants (front/back) by default. */
export function useReorder(
  adapter: ReorderAdapter,
  options: UseReorderOptions = {},
): UseReorderReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const dispatch = useCallback(
    (factory: (args: { ids: string[] }) => Op, label: string) => {
      const a = adapterRef.current;
      if (!a.getChildren || !a.setChildOrder) return;
      const sel = a.getSelection();
      const ids = optsRef.current.filter ? optsRef.current.filter(sel) : sel;
      if (ids.length === 0) return;
      const op = factory({ ids });
      dispatchApplyBatch(a, [op], label);
    },
    [],
  );

  const bringForward = useCallback(
    () => dispatch(({ ids }) => createReorderOp({ ids, direction: 'forward' }), 'Bring forward'),
    [dispatch],
  );
  const sendBackward = useCallback(
    () => dispatch(({ ids }) => createReorderOp({ ids, direction: 'backward' }), 'Send backward'),
    [dispatch],
  );
  const bringToFront = useCallback(
    () => dispatch(({ ids }) => createReorderOp({ ids, direction: 'front' }), 'Bring to front'),
    [dispatch],
  );
  const sendToBack = useCallback(
    () => dispatch(({ ids }) => createReorderOp({ ids, direction: 'back' }), 'Send to back'),
    [dispatch],
  );

  const reg = useActionsRegistry();
  const enable = options.enableKeyboard ?? true;

  // Provider path: register forward/backward through the registry. Front/back
  // variants stay on the always-on useKeybinding fallback below — the v1
  // single-binding-per-Action limit doesn't model the Shift-modified pair.
  useEffect(() => {
    if (!reg || !enable) return;
    const actions = defaultReorderActions({
      getSelection: () => adapterRef.current.getSelection(),
      applyBatch: (ops, label) => {
        const a = adapterRef.current;
        const ids = optsRef.current.filter
          ? optsRef.current.filter(a.getSelection())
          : a.getSelection();
        if (ids.length === 0) return;
        // The factory already builds ops from getSelection(); apply via the
        // adapter so its applyBatch (or fallback) handles it identically.
        if (!a.getChildren || !a.setChildOrder) return;
        dispatchApplyBatch(a, ops, label ?? '');
      },
    });
    const unregs = actions.map((act) => reg.register(act));
    return () => { for (const u of unregs) u(); };
  }, [reg, enable]);

  // Browsers sometimes report Shift+] as '}' / Shift+[ as '{'; accept both.
  // forward/backward route through the registry when in a provider scope.
  useKeybinding({ key: [']', '}'], mod: true, enabled: enable && reg == null }, () => bringForward());
  useKeybinding({ key: ['[', '{'], mod: true, enabled: enable && reg == null }, () => sendBackward());
  // front/back: registry doesn't model these in v1; keep them always-on so
  // Shift+Mod+] / Shift+Mod+[ still work whether or not a provider is mounted.
  useKeybinding({ key: [']', '}'], mod: true, shift: true, enabled: enable }, () => bringToFront());
  useKeybinding({ key: ['[', '{'], mod: true, shift: true, enabled: enable }, () => sendToBack());

  return { bringForward, sendBackward, bringToFront, sendToBack };
}
