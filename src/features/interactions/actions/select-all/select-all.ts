import { useCallback, useRef } from 'react';
import { createSetSelectionOp } from '../../../../core/ops/selection';
import type { Op } from '../../../../core/ops/types';
import { useKeybinding } from '../useKeybinding';

/** Adapter for `useSelectAll`. */
export interface SelectAllAdapter {
  /** Read current selection (used as `from` for the setSelection op). */
  getSelection(): string[];
  /** Return all selectable ids. */
  listAll(): string[];
  /** Required: standard op-batch entry point. */
  applyBatch(ops: Op[], label?: string): void;
}

/** Options for `useSelectAll`. */
export interface UseSelectAllOptions {
  /** Auto-bind Ctrl/Cmd+A on document. Default true. */
  enableKeyboard?: boolean;
  /** Label passed to applyBatch. Default 'Select all'. */
  label?: string;
}

/** Return shape of `useSelectAll`. */
export interface UseSelectAllReturn {
  /** Imperative trigger — selects every id from the adapter. */
  selectAll(): void;
}

/** Select-all action; binds Ctrl/Cmd+A on document by default. */
export function useSelectAll(
  adapter: SelectAllAdapter,
  options: UseSelectAllOptions = {},
): UseSelectAllReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const selectAll = useCallback((): void => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const all = a.listAll();
    if (all.length === 0) return;
    const from = a.getSelection();
    a.applyBatch(
      [createSetSelectionOp({ from, to: all })],
      o.label ?? 'Select all',
    );
  }, []);

  useKeybinding(
    { key: 'a', mod: true, enabled: options.enableKeyboard ?? true },
    () => selectAll(),
  );

  return { selectAll };
}
