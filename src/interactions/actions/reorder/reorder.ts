import { useCallback, useRef } from 'react';
import {
  createBringForwardOp,
  createSendBackwardOp,
  createBringToFrontOp,
  createSendToBackOp,
} from '../../../core/ops/reorder';
import type { Op } from '../../../core/ops/types';
import { dispatchApplyBatch } from '../../../core/applyOps';
import { useKeybinding } from '../useKeybinding';

/** Adapter for `useReorder`; both order methods optional and the hook no-ops when either is absent. */
export interface ReorderAdapter {
  getSelection(): string[];
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
  filter?: (ids: string[]) => string[];
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

  const bringForward = useCallback(() => dispatch(createBringForwardOp, 'Bring forward'), [dispatch]);
  const sendBackward = useCallback(() => dispatch(createSendBackwardOp, 'Send backward'), [dispatch]);
  const bringToFront = useCallback(() => dispatch(createBringToFrontOp, 'Bring to front'), [dispatch]);
  const sendToBack = useCallback(() => dispatch(createSendToBackOp, 'Send to back'), [dispatch]);

  const enable = options.enableKeyboard ?? true;
  // Browsers sometimes report Shift+] as '}' / Shift+[ as '{'; accept both.
  useKeybinding({ key: [']', '}'], mod: true, enabled: enable }, () => bringForward());
  useKeybinding({ key: ['[', '{'], mod: true, enabled: enable }, () => sendBackward());
  useKeybinding({ key: [']', '}'], mod: true, shift: true, enabled: enable }, () => bringToFront());
  useKeybinding({ key: ['[', '{'], mod: true, shift: true, enabled: enable }, () => sendToBack());

  return { bringForward, sendBackward, bringToFront, sendToBack };
}
