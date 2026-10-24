/** A custom scene mutation registered with `Scene.registerOp`: how to apply
 *  it and how to undo it. The pair is what makes it participate in history. */
export interface RegisteredOp<P> {
  apply: (payload: P) => void;
  revert: (payload: P) => void;
  /** Opts this kind into coalescing under `UseSceneOptions.coalesceWindowMs`:
   *  two entries of this kind that return the same key inside the window
   *  merge, and undoing the merged entry calls `revert` with the first
   *  payload only. Declare it only when `revert` restores an absolute state
   *  (a stored "from" value), never for a relative payload such as a delta.
   *  Omitted, or returning `undefined`, the op is always its own entry. */
  coalesceKey?: (payload: P) => string | undefined;
}
