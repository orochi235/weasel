/** Minimal hit descriptor passed to `onDoubleClick`. Contains the fields
 *  modality dispatch needs; extends as the kit's `Hit` type evolves. */
export interface SceneCanvasHit {
  id: string;
  kind: string;
}

/** `<SceneCanvas>`'s props for what the pointer can reach and what a click names. */
export interface SceneCanvasPointerProps {
  /**
   * Per-id pointer-interactivity predicate: an id it returns `false` for is excluded from
   * hit-test results. Typical use: suppressing pointer events for dimmed nodes.
   */
  isPointerInteractive?: (id: string) => boolean;

  /**
   * The group isolation is working inside, or null outside isolation. A double-click names the
   * outermost group above the node hit, stopping below this one, so each double-click drills one
   * group further in; where no group stands between them it names the node hit. Absent, groups
   * are named from the scene root. Single clicks are untouched.
   */
  isolatedGroup?: () => string | null;

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
}
