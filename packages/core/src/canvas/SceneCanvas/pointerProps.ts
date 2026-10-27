import type { EnteredGroupApi } from '../deps/enteredGroup';
import type { SceneCanvasTextEditor } from './defaultTextEditor';

/** Minimal hit descriptor passed to `onDoubleClick`. Contains the fields
 *  modality dispatch needs; extends as the kit's `Hit` type evolves. */
export interface SceneCanvasHit {
  id: string;
  kind: string;
}

/** `<SceneCanvas>`'s props for what the pointer can reach and what a click names. */
export interface SceneCanvasPointerProps<TData = unknown> {
  /**
   * Per-id pointer-interactivity predicate: an id it returns `false` for is excluded from
   * hit-test results. Typical use: suppressing pointer events for dimmed nodes.
   */
  isPointerInteractive?: (id: string) => boolean;

  /**
   * The entered group: the group a press resolves inside of, and which a double-click drills down
   * from. Nodes outside it take no hits. Pass one from `useEnteredGroup(scene)` to read or drive it
   * from outside the canvas, as `selection` is passed; without it the canvas keeps its own.
   */
  enteredGroup?: EnteredGroupApi;

  /**
   * Called when the user double-clicks the canvas, with the hit node (id + kind) at that
   * position, or `null` on empty canvas. A notification, not a binding: it fires whatever the
   * double-click does. Entering a mode on the node belongs to `modeTriggers` instead.
   */
  onDoubleClick?: (hit: SceneCanvasHit | null) => void;
  /** Called on every click — a press and release without a drag — with the
   *  node under it, or `null` on empty canvas. Fires after the click's own
   *  behavior, so a pick it made is already in the selection, and fires
   *  again on a node that was already picked. */
  onClick?: (hit: SceneCanvasHit | null) => void;
  /** Called when the topmost pickable node under the pointer changes, with
   *  its id, and with `null` once there is none or the pointer leaves. */
  onHover?: (id: string | null) => void;
  /**
   * The canvas's own text editor: what a text or sticky tool's `enterTextEdit`
   * opens, and, with the `edit` feature, a double-click on a text node. Pass
   * `useSceneTextEdit`'s options to configure it, or `false` for none.
   *
   * It mounts its overlay in the canvas's offset parent, so the canvas wants a
   * positioned ancestor. It stands down for a host's own editor: a
   * `useSceneTextEdit` whose container holds the canvas, or a `textEdit` dep
   * registered by a child. Wire one of those for character controls, which
   * read the edit's state.
   */
  textEditor?: SceneCanvasTextEditor<TData>;
}
