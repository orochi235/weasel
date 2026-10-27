/**
 * The deps behind text editing, the clipboard, and Slice.
 */
import type { Point2 } from '@weasel-js/routing';

/**
 * Dep for `enterTextEditAction`. `<SceneCanvas>` answers it with its own
 * editor (its `textEditor` prop); a host with an editor of its own, one
 * driving character controls, publishes it instead.
 *
 * Wrap the return value of `useTextEdit` / `useSceneTextEdit` to source this
 * dep. The `isTextNode` predicate is optional — when absent the action fires
 * unconditionally (the binding spec acts as the gate).
 *
 * @example
 * ```ts
 * const textEdit = useSceneTextEdit(scene, container);
 * useDepSource('textEdit', () => ({
 *   startEdit: textEdit.startEdit,
 *   isTextNode: textEdit.isTextNode,
 * }));
 * ```
 */
export interface TextEditDep {
  /** Begin editing the node with `id`. */
  startEdit(id: string, opts?: { caret?: number | 'all' }): void;
  /**
   * Optional predicate: returns `true` when the node with `id` is a text node.
   * When absent the action fires on any selected node (binding spec is the gate).
   * When present and returning `false`, the invocation is a no-op.
   */
  isTextNode?(id: string): boolean;
}

/**
 * Clipboard dep — the imperative surface `useClipboardOps` returns.
 *
 * Consumers publish their live clipboard through `useDepSource('clipboard',
 * …)` from inside the `<DepRegistryProvider>` (i.e. under `<SceneCanvas>`).
 * The kit deliberately does not build one for them: `useClipboardOps` needs
 * an adapter and a selection reader that only the consumer can supply.
 */
export interface ClipboardDep {
  copy(): void;
  paste(at?: { worldX: number; worldY: number }): void;
  isEmpty(): boolean;
}

/**
 * The commit behind the Slice action. `commit` receives the cut as a polyline
 * of at least two points (world coords): the drag's two ends for a straight
 * cut, its whole trail for a freehand one, the placed points for a
 * click-by-click one, whose last point equals its first when it closes into
 * a loop. `<SceneCanvas>` publishes one over its scene (`useSliceDepSource`);
 * a consumer replaces it with `useSliceDep`.
 */
export interface SliceDep {
  commit(cut: ReadonlyArray<Point2>): void;
}
