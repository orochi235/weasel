import { createReorderOp } from '../../../core/ops/reorder';
import type { Op } from '../../../core/ops/types';
import type { Action } from '../registry';

/** @experimental */
export interface ReorderDeps {
  getSelection: () => string[];
  applyBatch: (ops: Op[], label?: string) => void;
}

/**
 * @experimental
 * Factory for the two default reorder Actions: `reorder.forward` (Mod+])
 * and `reorder.backward` (Mod+[). Front/back variants are deferred — they
 * collide with v1's single-binding-per-Action limit. Use `useReorder` for
 * those (it keeps the standalone-keybinding fallback always-on for
 * Shift+Mod+] / Shift+Mod+[).
 */
export function defaultReorderActions(deps: ReorderDeps): Action[] {
  return [
    {
      id: 'reorder.forward',
      label: 'Bring Forward',
      defaultBinding: { key: [']', '}'], mod: true },
      run: () => {
        const ids = deps.getSelection();
        if (ids.length === 0) return;
        deps.applyBatch([createReorderOp({ ids, direction: 'forward' })], 'Bring forward');
      },
    },
    {
      id: 'reorder.backward',
      label: 'Send Backward',
      defaultBinding: { key: ['[', '{'], mod: true },
      run: () => {
        const ids = deps.getSelection();
        if (ids.length === 0) return;
        deps.applyBatch([createReorderOp({ ids, direction: 'backward' })], 'Send backward');
      },
    },
  ];
}
