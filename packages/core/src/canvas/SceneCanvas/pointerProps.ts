import type { EnteredGroupApi } from '../deps/enteredGroup';

/** The node a click or double-click landed on, as `onClick` and `onDoubleClick` report it. */
export interface SceneCanvasHit {
  id: string;
  kind: string;
  /** The world point the node was picked at: where the click was released. */
  world: { x: number; y: number };
}

/** `<SceneCanvas>`'s props for what the pointer can reach and what a click names. */
export interface SceneCanvasPointerProps {
  /**
   * Per-id pointer-interactivity predicate: an id it returns `false` for is excluded from
   * hit-test results. Typical use: suppressing pointer events for dimmed nodes.
   */
  isPointerInteractive?: (id: string) => boolean;

  /**
   * The entered group: the group a press resolves inside of, and which a double-click drills down
   * from. Nodes outside it take no hits. Without it the canvas uses the scene's own, which
   * `useEnteredGroup(scene)` reads and drives from anywhere; pass `createEnteredGroup(scene)` for a separate one.
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
}
