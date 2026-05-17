import { createReorderOp } from 'core/ops/reorder';
import type { Op } from 'core/ops/types';
import type { NodeId, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

type ReorderDistance = 'adjacent' | 'extreme';

/**
 * Execute a directional reorder on the current selection using the Scene API.
 * Translates `direction` + `distance` into the four-way `ReorderDirection`
 * understood by `createReorderOp`, then applies the op through an inline
 * adapter synthesised from the Scene.
 */
function reorderSelection(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  direction: 'forward' | 'backward',
  distance: ReorderDistance,
): void {
  const ids = selection.get() as string[];
  if (ids.length === 0) return;

  const reorderDir =
    direction === 'forward'
      ? distance === 'extreme' ? 'front' : 'forward'
      : distance === 'extreme' ? 'back' : 'backward';

  const op = createReorderOp({ ids, direction: reorderDir });

  // Inline adapter — mirrors the shape in canvas/sceneAdapter.ts.
  const adapter = {
    getParent(id: string): string | null {
      // For now all nodes live at the root level (flat scene).
      // Phase N: thread parent lookup through Scene when nested groups land.
      void id;
      return null;
    },
    getChildren(parentId: string | null): string[] {
      if (parentId === null) return [...scene.roots] as string[];
      return [...scene.childrenOf(parentId as NodeId)] as string[];
    },
    setChildOrder(parentId: string | null, orderedIds: string[]): void {
      scene.batch('Reorder', () => {
        for (let i = 0; i < orderedIds.length; i++) {
          const current =
            parentId === null
              ? (scene.roots as readonly string[])
              : (scene.childrenOf(parentId as NodeId) as readonly string[]);
          if (current[i] === orderedIds[i]) continue;
          scene.reorder(orderedIds[i] as NodeId, i);
        }
      });
    },
  };

  op.apply(adapter);
}

// ---------------------------------------------------------------------------
// Phase 4 descriptors
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Parametric descriptor for forward reorder (`reorder.forward`).
 *
 * Collapses the old `reorder.forward` (adjacent) and `reorder.front`
 * (extreme) actions into one descriptor with two keybindings. The distance
 * param (`'adjacent'` | `'extreme'`) is carried in `opts.params.distance`
 * and forwarded to `invoker.run` by the dispatcher.
 */
export const reorderForwardAction: Action = {
  id: 'reorder.forward',
  label: 'Bring Forward',
  gestureBinding: [
    {
      spec: { kind: 'key', key: [']', '}'], mods: { mod: true } },
      opts: { params: { distance: 'adjacent' } },
    },
    {
      spec: { kind: 'key', key: [']', '}'], mods: { mod: true, shift: true } },
      opts: { params: { distance: 'extreme' } },
    },
  ],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const distance = (params?.distance as ReorderDistance | undefined) ?? 'adjacent';
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      if (!selection || !scene) return;
      reorderSelection(selection, scene, 'forward', distance);
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};

/**
 * @experimental
 * Parametric descriptor for backward reorder (`reorder.backward`).
 *
 * Collapses the old `reorder.backward` (adjacent) and `reorder.back`
 * (extreme) actions into one descriptor with two keybindings.
 */
export const reorderBackwardAction: Action = {
  id: 'reorder.backward',
  label: 'Send Backward',
  gestureBinding: [
    {
      spec: { kind: 'key', key: ['[', '{'], mods: { mod: true } },
      opts: { params: { distance: 'adjacent' } },
    },
    {
      spec: { kind: 'key', key: ['[', '{'], mods: { mod: true, shift: true } },
      opts: { params: { distance: 'extreme' } },
    },
  ],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const distance = (params?.distance as ReorderDistance | undefined) ?? 'adjacent';
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      if (!selection || !scene) return;
      reorderSelection(selection, scene, 'backward', distance);
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};

// ---------------------------------------------------------------------------
// Legacy bridge (Phase 4–7 shim; removed in Phase 8)
// ---------------------------------------------------------------------------

/** @experimental */
export interface ReorderDeps {
  getSelection: () => NodeId[];
  applyOps: (ops: Op[], label?: string) => void;
}

/**
 * @experimental
 * Factory for the legacy four-action reorder set. Preserves the original ids
 * (`reorder.forward`, `reorder.backward`, `reorder.front`, `reorder.back`)
 * so palette / menu UIs that look actions up by id continue to work.
 *
 * @deprecated Phase 4+: use `reorderForwardAction` / `reorderBackwardAction`.
 * Removed in Phase 8.
 */
export function defaultReorderActions(deps: ReorderDeps): Action[] {
  const requireSelection = () =>
    (deps.getSelection().length > 0 ? true : ActionDisabledReason.SelectionRequired);

  return [
    {
      id: 'reorder.forward',
      label: 'Bring Forward',
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
