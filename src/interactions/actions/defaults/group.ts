import { createCreateGroupOp } from 'features/groups/ops/createGroup';
import { createDissolveGroupOp } from 'features/groups/ops/dissolveGroup';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import type { Group } from 'features/groups/types';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import { deriveDefaultBinding } from './_keyBindingFromGesture';

/** @experimental */
export interface GroupDeps {
  getSelection: () => NodeId[];
  applyOps: (ops: Op[], label?: string) => void;
  /** Mint the id for the new group. Default `g_${time}_${random}`. */
  newGroupId?: () => string;
  /** Minimum selection size that produces a group. Default 2. */
  minMembers?: number;
}

/** @experimental */
export interface UngroupDeps {
  getSelection: () => NodeId[];
  /** Look up an existing group by id. Returns `undefined` for
   *  non-group ids. */
  getGroup: (id: string) => Group | undefined;
  applyOps: (ops: Op[], label?: string) => void;
}

function defaultMintId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @experimental
 * Static descriptor for the `group` Action.
 */
export const groupAction: Action = {
  id: 'group',
  label: 'Group',
  gestureBinding: { kind: 'key', key: 'g', mods: { mod: true } },
  invoker: {
    timing: 'immediate',
    run: (_deps, params) => {
      // Stub — applyOps/newGroupId deps only available via factory. Task 8 wires.
      void params;
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};

/**
 * @experimental
 * Static descriptor for the `ungroup` Action.
 */
export const ungroupAction: Action = {
  id: 'ungroup',
  label: 'Ungroup',
  gestureBinding: { kind: 'key', key: 'g', mods: { mod: true, shift: true } },
  invoker: {
    timing: 'immediate',
    run: (_deps, params) => {
      // Stub — getGroup/applyOps deps only available via factory. Task 8 wires.
      void params;
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};

/**
 * @experimental
 * Factory for the default virtual-`group` Action. No-op when selection size
 * is below `minMembers`.
 *
 * @deprecated Phase 4+: use `groupAction` directly. This wrapper is a
 * Phase 4–7 transition shim and will be removed in Phase 8.
 */
export function defaultGroupAction(deps: GroupDeps): Action {
  const minMembers = deps.minMembers ?? 2;
  const mint = deps.newGroupId ?? defaultMintId;
  // Exclude `invoker` so the legacy run path stays active until Task 8.
  const { invoker: _invoker, enabled: _enabled, ...descriptorFields } = groupAction;
  void _invoker;
  void _enabled;
  return {
    ...descriptorFields,
    defaultBinding: deriveDefaultBinding(groupAction.gestureBinding),
    run: () => {
      const sel = deps.getSelection();
      if (sel.length < minMembers) return;
      const id = mint();
      const g: Group = { id, members: [...sel] };
      const ops: Op[] = [
        createCreateGroupOp({ group: g }),
        createSetSelectionOp({ from: sel, to: [id as NodeId] }),
      ];
      deps.applyOps(ops, 'Group');
    },
    enabled: () =>
      deps.getSelection().length >= minMembers
        ? true
        : ActionDisabledReason.SelectionRequired,
  };
}

/**
 * @experimental
 * Factory for the default virtual-`ungroup` Action. No-op when no group is
 * in the selection.
 *
 * @deprecated Phase 4+: use `ungroupAction` directly. This wrapper is a
 * Phase 4–7 transition shim and will be removed in Phase 8.
 */
export function defaultUngroupAction(deps: UngroupDeps): Action {
  const hasGroup = (): boolean => {
    for (const id of deps.getSelection()) if (deps.getGroup(id) !== undefined) return true;
    return false;
  };
  // Exclude `invoker` so the legacy run path stays active until Task 8.
  const { invoker: _invoker, enabled: _enabled, ...descriptorFields } = ungroupAction;
  void _invoker;
  void _enabled;
  return {
    ...descriptorFields,
    defaultBinding: deriveDefaultBinding(ungroupAction.gestureBinding),
    run: () => {
      const sel = deps.getSelection();
      if (sel.length === 0) return;
      const dissolved: { group: Group }[] = [];
      const next: string[] = [];
      const seen = new Set<string>();
      const push = (id: string): void => {
        if (seen.has(id)) return;
        seen.add(id);
        next.push(id);
      };
      for (const id of sel) {
        const g = deps.getGroup(id);
        if (g === undefined) {
          push(id);
          continue;
        }
        dissolved.push({ group: { id: g.id, members: [...g.members] } });
        for (const m of g.members) push(m);
      }
      if (dissolved.length === 0) return;
      const ops: Op[] = dissolved.map(({ group }) => createDissolveGroupOp({ group }));
      ops.push(createSetSelectionOp({ from: sel, to: next as NodeId[] }));
      deps.applyOps(ops, 'Ungroup');
    },
    enabled: () =>
      hasGroup() ? true : ActionDisabledReason.SelectionRequired,
  };
}
