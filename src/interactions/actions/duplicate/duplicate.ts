import { useCallback, useEffect, useRef } from 'react';
import { createInsertOp } from 'core/ops/create';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';
import { useKeybinding } from '../useKeybinding';
import { useActionsRegistry, type Action } from '../registry';

/** Adapter for `useDuplicate`. */
export interface DuplicateAdapter<TPose> {
  /** Read current selection. */
  getSelection(): NodeId[];
  /** Read pose for an id (currently unused at op-emit time but exposed for
   *  symmetry with other selection-driven hooks; consumers commonly need it
   *  inside `cloneObject`). */
  getPose(id: NodeId): TPose;
  /** Materialize a new object that is a copy of `id`, translated by `offset`.
   *  Implementations are responsible for assigning a fresh id and for any
   *  domain-specific cloning rules. The returned object is wrapped in an
   *  InsertOp by the hook. */
  cloneObject(id: NodeId, offset: { dx: number; dy: number }): { id: NodeId };
  /** Optional: op-batch entry point. When omitted, the hook applies each op
   *  against the adapter directly. Apps with custom history integration
   *  override this. */
  applyBatch?(ops: Op[], label?: string): void;
}

/** Options for `useDuplicate`. */
export interface UseDuplicateOptions {
  /** Auto-bind Ctrl/Cmd+D on document. Default true. */
  enableKeyboard?: boolean;
  /** Label passed to applyBatch. Default 'Duplicate'. */
  label?: string;
  /** Translation applied to each clone. Default `{ dx: 8, dy: 8 }`. */
  offset?: { dx: number; dy: number };
}

/** Return shape of `useDuplicate`. */
export interface UseDuplicateReturn {
  /** Imperative trigger — duplicates the current selection. */
  duplicate(): void;
}

const DEFAULT_OFFSET = { dx: 8, dy: 8 };

/** Selection-duplication action with offset; binds Ctrl/Cmd+D by default. */
export function useDuplicate<TPose>(
  adapter: DuplicateAdapter<TPose>,
  options: UseDuplicateOptions = {},
): UseDuplicateReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const duplicate = useCallback((): void => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const sel = a.getSelection();
    if (sel.length === 0) return;
    const offset = o.offset ?? DEFAULT_OFFSET;
    const created = sel.map((id) => a.cloneObject(id, offset));
    if (created.length === 0) return;
    const newIds = created.map((c) => c.id);
    const ops: Op[] = [
      ...created.map((obj) => createInsertOp({ object: obj })),
      createSetSelectionOp({ from: sel, to: newIds }),
    ];
    dispatchApplyBatch(a, ops, o.label ?? 'Duplicate');
  }, []);

  const reg = useActionsRegistry();
  const enableKeyboard = options.enableKeyboard ?? true;

  useEffect(() => {
    if (!reg || !enableKeyboard) return;
    const action: Action = {
      id: 'duplicate',
      label: 'Duplicate',
      defaultBinding: { key: 'd', mod: true },
      run: () => duplicate(),
    };
    return reg.register(action);
  }, [reg, enableKeyboard, duplicate]);

  useKeybinding(
    { key: 'd', mod: true, enabled: enableKeyboard && reg == null },
    () => duplicate(),
  );

  return { duplicate };
}
