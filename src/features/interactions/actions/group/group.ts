import { useCallback, useRef } from 'react';
import { createCreateGroupOp } from '../../../groups/ops/createGroup';
import { createDissolveGroupOp } from '../../../groups/ops/dissolveGroup';
import { createSetSelectionOp } from '../../../../core/ops/selection';
import type { Op } from '../../../../core/ops/types';
import { dispatchApplyBatch } from '../../../../core/ops/applyOpsTo';
import type { Group, GroupAdapter } from '../../../groups/types';
import { useKeybinding } from '../useKeybinding';

/** Adapter for `useGroup` / `useUngroup`. */
export interface GroupActionAdapter extends GroupAdapter {
  /** Read current selection. */
  getSelection(): string[];
  /** Optional: op-batch entry point. When omitted, ops apply directly. */
  applyBatch?(ops: Op[], label: string): void;
}

/** Options for `useGroup`. */
export interface UseGroupOptions {
  /** Auto-bind Mod+G on document. Default false. */
  bindKeyboard?: boolean;
  /** Mint the id for the new group. Default: `g_${Date.now()}_${random}`. */
  newGroupId?: () => string;
  /** Label passed to applyBatch. Default 'Group'. */
  label?: string;
  /** Minimum selection size that produces a group. Default 2 — single-id
   *  selections are a no-op since wrapping one object adds no structure. */
  minMembers?: number;
}

/** Return shape of `useGroup`. */
export interface UseGroupReturn {
  /** Imperative trigger — wraps the current selection in a new group, then
   *  selects that group. Returns the new group id, or `null` if no group was
   *  created (selection too small). */
  group(): string | null;
}

function defaultMintId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Selection-grouping action; optionally binds Mod+G. */
export function useGroup(
  adapter: GroupActionAdapter,
  options: UseGroupOptions = {},
): UseGroupReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const group = useCallback((): string | null => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const sel = a.getSelection();
    const min = o.minMembers ?? 2;
    if (sel.length < min) return null;
    const id = (o.newGroupId ?? defaultMintId)();
    const g: Group = { id, members: [...sel] };
    const ops: Op[] = [
      createCreateGroupOp({ group: g }),
      createSetSelectionOp({ from: sel, to: [id] }),
    ];
    dispatchApplyBatch(a, ops, o.label ?? 'Group');
    return id;
  }, []);

  useKeybinding(
    { key: 'g', mod: true, enabled: !!options.bindKeyboard },
    () => { group(); },
  );

  return { group };
}

/** Options for `useUngroup`. */
export interface UseUngroupOptions {
  /** Auto-bind Mod+Shift+G on document. Default false. */
  bindKeyboard?: boolean;
  /** Label passed to applyBatch. Default 'Ungroup'. */
  label?: string;
}

/** Return shape of `useUngroup`. */
export interface UseUngroupReturn {
  /** Imperative trigger — dissolves every group in the current selection.
   *  Selection becomes the union of dissolved members and any non-group ids
   *  that were already selected. Returns the ids of dissolved groups, or
   *  `[]` if none were found. */
  ungroup(): string[];
}

/** Selection-ungrouping action; optionally binds Mod+Shift+G. */
export function useUngroup(
  adapter: GroupActionAdapter,
  options: UseUngroupOptions = {},
): UseUngroupReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const ungroup = useCallback((): string[] => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const sel = a.getSelection();
    if (sel.length === 0) return [];

    const dissolved: { group: Group }[] = [];
    const nextSelection: string[] = [];
    const seen = new Set<string>();
    const push = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      nextSelection.push(id);
    };

    for (const id of sel) {
      const g = a.getGroup(id);
      if (g === undefined) {
        push(id);
        continue;
      }
      dissolved.push({ group: { id: g.id, members: [...g.members] } });
      for (const m of g.members) push(m);
    }
    if (dissolved.length === 0) return [];

    const ops: Op[] = dissolved.map(({ group }) => createDissolveGroupOp({ group }));
    ops.push(createSetSelectionOp({ from: sel, to: nextSelection }));
    dispatchApplyBatch(a, ops, o.label ?? 'Ungroup');
    return dissolved.map((d) => d.group.id);
  }, []);

  useKeybinding(
    { key: 'g', mod: true, shift: true, enabled: !!options.bindKeyboard },
    () => { ungroup(); },
  );

  return { ungroup };
}
