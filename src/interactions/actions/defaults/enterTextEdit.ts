/**
 * `enterTextEditAction` — immediate Action descriptor for entering in-place
 * text editing on a selected text node.
 *
 * ## Status: REAL
 *
 * Fires via `useTextTool.bindings` when the user clicks on a
 * selected text node. Calls `deps.textEdit.startEdit(id)` to activate the
 * contenteditable overlay managed by `useTextEdit` / `useSceneTextEdit`.
 *
 * ## No defaultBinding / defaultBinding
 *
 * This action has no ambient key or gesture binding — it fires ONLY via
 * `useTextTool`'s `Tool.bindings` entry:
 *
 * ```ts
 * bindings: [
 *   { spec: { kind: 'click', target: 'selected-body' }, actionId: 'enterTextEdit' },
 * ]
 * ```
 *
 * Keeping it binding-free avoids ambient double-fire and scopes the action to
 * the text tool context where `classifyTarget` is already wired.
 *
 * ## Self-guard: only act on text nodes
 *
 * The `classifyTarget` thunk yields `'selected-body'` for any selected node
 * kind — there's no per-kind filter yet (that's a Phase 14e follow-up). To
 * avoid entering text-edit mode when the text tool happens to have a non-text
 * node selected, the action self-guards via an optional `isTextNode` predicate
 * on `TextEditDep`:
 *
 * - When `isTextNode` is absent: action fires unconditionally (the binding
 *   spec is the real gate — consumers should only bind this action from the
 *   text tool).
 * - When `isTextNode(id)` returns `false`: action is a no-op for that node.
 *
 * ### Future: per-kind target classification (Phase 14e)
 *
 * Once `classifyTarget` surfaces node-kind info on body hits, the binding spec
 * can use a `{ kindOf: hit => hit?.kind === 'text' }` predicate to pre-filter
 * at dispatch time, making the `isTextNode` guard redundant. The action can
 * then drop `isTextNode` from `TextEditDep`.
 *
 * ## Migration plan for useTextTool
 *
 * When wiring `useTextTool` to `Tool.bindings`:
 *
 * 1. Add to `useTextTool`'s `bindings`:
 *    ```ts
 *    { spec: { kind: 'click', target: 'selected-body' }, actionId: 'enterTextEdit' }
 *    ```
 * 2. Register a `textEdit` dep sourced from the `useTextEdit` / `useSceneTextEdit`
 *    return value, plus an `isTextNode` predicate that checks `data.kind === 'text'`
 *    (or however the consumer identifies text nodes).
 * 3. The existing `hitExisting` gate in `useTextTool`'s click route becomes
 *    redundant — remove it in Phase 14e dead-code cleanup.
 */

import type { Action } from '../registry';
import type { NodeId } from 'core/scene/types';

// ---------------------------------------------------------------------------
// TextEditDep
// ---------------------------------------------------------------------------

/**
 * Dep for `enterTextEditAction`.
 *
 * Wrap the return value of `useTextEdit` / `useSceneTextEdit` to source this
 * dep. The `isTextNode` predicate is optional — when absent the action fires
 * unconditionally (the binding spec acts as the gate).
 *
 * @example
 * ```ts
 * const textEdit = useSceneTextEdit({ scene, container });
 * useDepSource('textEdit', () => ({
 *   startEdit: textEdit.startEdit,
 *   isTextNode: (id) => scene.get(id as NodeId)?.data?.kind === 'text',
 * }));
 * ```
 */
export interface TextEditDep {
  /**
   * Begin editing the node with `id`. Activates the contenteditable overlay
   * managed by `useTextEdit` / `useSceneTextEdit`.
   */
  startEdit(id: string, opts?: { caret?: number | 'all' }): void;
  /**
   * Optional predicate: returns `true` when the node with `id` is a text node.
   * When absent the action fires on any selected node (binding spec is the gate).
   * When present and returning `false`, the invocation is a no-op.
   */
  isTextNode?(id: string): boolean;
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `enterTextEdit` Action.
 *
 * Requires dep-schema entries: `textEdit`, `selection`.
 *
 * No `defaultBinding` / `defaultBinding` — fires only via `Tool.bindings`.
 * Self-guards via `TextEditDep.isTextNode` when provided.
 */
export const enterTextEditAction: Action & { requires: string[] } = {
  id: 'enterTextEdit',
  label: 'Enter text edit',
  // No defaultBinding / defaultBinding — fires only via Tool.bindings.
  eligible: { mode: { in: ['normal', 'isolation'] } },
  requires: ['textEdit', 'selection'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const sel = (deps.selection as { get(): NodeId[] } | undefined)?.get() ?? [];
      if (sel.length !== 1) return;

      const id = sel[0];
      const textEdit = deps.textEdit as TextEditDep | undefined;
      if (!textEdit) return;

      // Self-guard: skip non-text nodes when the predicate is supplied.
      if (textEdit.isTextNode && !textEdit.isTextNode(id)) return;

      textEdit.startEdit(id);
    },
  },
};
