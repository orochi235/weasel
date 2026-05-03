import { useCallback, useRef } from 'react';
import { createSetSelectionOp } from '../../../../core/ops/selection';
import type { Op } from '../../../../core/ops/types';
import { useKeybinding } from '../useKeybinding';

/** Adapter for `useEscape`. */
export interface EscapeAdapter {
  /** Read current selection. */
  getSelection(): string[];
  /** Required: standard op-batch entry point. */
  applyBatch(ops: Op[], label?: string): void;
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
    a.applyBatch([op], o.label ?? 'Clear selection');
  }, []);

  useKeybinding(
    { key: 'Escape', enabled: options.enableKeyboard ?? true },
    () => clearSelection(),
  );

  return { clearSelection };
}
