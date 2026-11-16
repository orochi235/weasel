/**
 * The `textEdit` dep: what opens a text node for editing. This package adds it
 * to routing's `DepSchema`, as a consumer merges its own deps.
 */
import type { Point2 } from '@weasel-js/routing';

/**
 * Dep for `enterTextEditAction`. `textPreset` answers it with the canvas's own
 * editor (`createTextPreset`'s `editor`), or with the editor of a host's
 * `useSceneTextEdit` whose container holds the canvas. A host whose editor's
 * container does not hold the canvas publishes it from inside `<SceneCanvas>`:
 *
 * @example
 * ```ts
 * const textEdit = useSceneTextEdit(scene, container);
 * useDepSource('textEdit', () => ({
 *   startEdit: textEdit.startEdit,
 *   textAt: textEdit.textAt,
 *   isTextNode: textEdit.isTextNode,
 * }));
 * ```
 */
export interface TextEditDep {
  /** Begin editing the node with `id`. */
  startEdit(id: string, opts?: { caret?: number | 'all' }): void;
  /**
   * The top-most text node this editor would open at world point `at`, and
   * the caret at the glyph there, or `null` where there is none. A
   * double-click opens what this answers (`enterTextEdit.doubleClick`).
   */
  textAt(at: Point2): { id: string; caret: number } | null;
  /**
   * Optional predicate: returns `true` when the node with `id` is a text node.
   * When absent the action fires on any selected node (binding spec is the gate).
   * When present and returning `false`, the invocation is a no-op.
   */
  isTextNode?(id: string): boolean;
}

declare module '@weasel-js/routing' {
  interface DepSchema {
    /**
     * Text-edit dep — activates the in-place text editing overlay. `textPreset`
     * publishes the canvas's own editor, or a host's `useSceneTextEdit`.
     *
     * The optional `isTextNode` predicate guards against entering edit mode on
     * non-text nodes. A binding can pre-filter instead with a
     * `target: 'kind:text:selected'` spec; the guard remains for consumers who
     * bind the broader `'selected-body'` target or opted out of routing.
     */
    textEdit: TextEditDep;
  }
}
