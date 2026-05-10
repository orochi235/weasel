import { useCallback, useEffect, useRef } from 'react';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';
import { useKeybinding } from '../useKeybinding';
import { useActionsRegistry, type Action } from '../registry';

/** Adapter for `useEscape`. */
export interface EscapeAdapter {
  /** Read current selection. */
  getSelection(): NodeId[];
  /** Optional: op-batch entry point. When omitted, ops apply directly. */
  applyBatch?(ops: Op[], label?: string): void;
  /** Mutator wired by `setSelection` op when `applyBatch` is omitted. */
  setSelection?(ids: NodeId[]): void;
}

/** Options for `useEscape`. */
export interface UseEscapeOptions {
  /** Auto-bind Escape on document. Default true. */
  enableKeyboard?: boolean;
  /** Label passed to applyBatch. Default 'Clear selection'. */
  label?: string;
}

/** Return shape of `useEscape`. */
export interface UseEscapeReturn {
  /** Imperative trigger — clears the current selection. */
  clearSelection(): void;
}

/** Selection-clearing action; binds Escape on document by default. */
export function useEscape(
  adapter: EscapeAdapter,
  options: UseEscapeOptions = {},
): UseEscapeReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const clearSelection = useCallback((): void => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const sel = a.getSelection();
    if (sel.length === 0) return;
    const op = createSetSelectionOp({ from: sel, to: [] });
    dispatchApplyBatch(a, [op], o.label ?? 'Clear selection');
  }, []);

  const reg = useActionsRegistry();
  const enableKeyboard = options.enableKeyboard ?? true;

  useEffect(() => {
    if (!reg || !enableKeyboard) return;
    const action: Action = {
      id: 'escape',
      label: 'Escape',
      defaultBinding: { key: 'Escape' },
      run: () => clearSelection(),
    };
    return reg.register(action);
  }, [reg, enableKeyboard, clearSelection]);

  useKeybinding(
    { key: 'Escape', enabled: enableKeyboard && reg == null },
    () => clearSelection(),
  );

  return { clearSelection };
}
