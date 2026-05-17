import { useCallback, useEffect, useRef } from 'react';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';
import { useKeybinding } from '../useKeybinding';
import { useActionsRegistry, type Action } from '../registry';

/** Adapter for `useSelectAll`. */
export interface SelectAllAdapter {
  /** Read current selection (used as `from` for the setSelection op). */
  getSelection(): NodeId[];
  /** Return all selectable ids. */
  listAll(): NodeId[];
  /** Optional: op-batch entry point. When omitted, ops apply directly. */
  applyOps?(ops: Op[], label?: string): void;
  /** Mutator wired by `setSelection` op when `applyOps` is omitted. */
  setSelection?(ids: NodeId[]): void;
}

/** Options for `useSelectAll`. */
export interface UseSelectAllOptions {
  /** Auto-bind Ctrl/Cmd+A on document. Default true. */
  enableKeyboard?: boolean;
  /** Label passed to applyOps. Default 'Select all'. */
  label?: string;
}

/** Return shape of `useSelectAll`. */
export interface UseSelectAllReturn {
  /** Imperative trigger — selects every id from the adapter. */
  selectAll(): void;
}

/**
 * Select-all action; binds Ctrl/Cmd+A on document by default. When a parent
 * `<ActionsProvider>` is in scope, the binding is registered with the
 * registry instead of attaching its own keydown listener — so a single
 * scope-level listener handles dispatch.
 */
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
    dispatchApplyBatch(
      a,
      [createSetSelectionOp({ from, to: all })],
      o.label ?? 'Select all',
    );
  }, []);

  const reg = useActionsRegistry();
  const enableKeyboard = options.enableKeyboard ?? true;

  // Provider path: register an Action; cleanup unregisters.
  useEffect(() => {
    if (!reg || !enableKeyboard) return;
    const action: Action = {
      id: 'selectAll',
      label: 'Select All',
      run: () => selectAll(),
    };
    return reg.register(action);
  }, [reg, enableKeyboard, selectAll]);

  // Fallback path: direct keydown when no provider.
  useKeybinding(
    { key: 'a', mod: true, enabled: enableKeyboard && reg == null },
    () => selectAll(),
  );

  return { selectAll };
}
