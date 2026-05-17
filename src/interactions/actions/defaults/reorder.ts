import { createReorderOp } from 'core/ops/reorder';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

/** @experimental */
export interface ReorderDeps {
  getSelection: () => NodeId[];
  applyOps: (ops: Op[], label?: string) => void;
}

/**
 * @experimental
 * Factory for the four default reorder Actions:
 *   - `reorder.forward`  (⌘+])      — bring one step forward
 *   - `reorder.backward` (⌘+[)      — send one step backward
 *   - `reorder.front`    (⇪+⌘+])   — bring all the way to the front
 *   - `reorder.back`     (⇪+⌘+[)   — send all the way to the back
 */
export function defaultReorderActions(deps: ReorderDeps): Action[] {
  const requireSelection = () =>
    (deps.getSelection().length > 0 ? true : ActionDisabledReason.SelectionRequired);
  return [
    {
      id: 'reorder.forward',
      label: 'Bring Forward',
      defaultBinding: { key: [']', '}'], mod: true },
      gestureBinding: { kind: 'key', key: [']', '}'], mods: { mod: true } },
      run: () => {
        const ids = deps.getSelection();
        if (ids.length === 0) return;
        deps.applyOps([createReorderOp({ ids, direction: 'forward' })], 'Bring forward');
      },
      enabled: requireSelection,
    },
    {
      id: 'reorder.backward',
      label: 'Send Backward',
      defaultBinding: { key: ['[', '{'], mod: true },
      gestureBinding: { kind: 'key', key: ['[', '{'], mods: { mod: true } },
      run: () => {
        const ids = deps.getSelection();
        if (ids.length === 0) return;
        deps.applyOps([createReorderOp({ ids, direction: 'backward' })], 'Send backward');
      },
      enabled: requireSelection,
    },
    {
      id: 'reorder.front',
      label: 'Bring to Front',
      defaultBinding: { key: [']', '}'], mod: true, shift: true },
      gestureBinding: { kind: 'key', key: [']', '}'], mods: { mod: true, shift: true } },
      run: () => {
        const ids = deps.getSelection();
        if (ids.length === 0) return;
        deps.applyOps([createReorderOp({ ids, direction: 'front' })], 'Bring to front');
      },
      enabled: requireSelection,
    },
    {
      id: 'reorder.back',
      label: 'Send to Back',
      defaultBinding: { key: ['[', '{'], mod: true, shift: true },
      gestureBinding: { kind: 'key', key: ['[', '{'], mods: { mod: true, shift: true } },
      run: () => {
        const ids = deps.getSelection();
        if (ids.length === 0) return;
        deps.applyOps([createReorderOp({ ids, direction: 'back' })], 'Send to back');
      },
      enabled: requireSelection,
    },
  ];
}
