import type { NodeId } from '@weasel-js/routing';

/**
 * Decides what one edit's changes to containers do to their children.
 * `arrivals` maps each container to the ids that joined it — by an `add`
 * under it or a `move` into it, whatever op or call made them — in the order
 * they arrived. `changed` names every container whose child set or order
 * changed, whose pose changed size, or one of whose children was posed,
 * arrivals included. Both are read once the edit's other mutations have landed.
 *
 * Return the poses to write, in each node's stored frame; they become part of
 * the same edit, and so of the same undo step. An empty map writes nothing.
 * Return `null` to refuse: the whole edit is reverted (see
 * `SceneArrivalRefused`).
 *
 * Runs only for live edits. Undo, redo and a restored history replay the
 * arrangement that was decided the first time. With none installed, a scene
 * holding declared layouts (`GroupNode.layout`) runs its own.
 */
export type SceneArrivalHandler<TPose> = (
  arrivals: ReadonlyMap<NodeId, readonly NodeId[]>,
  changed: ReadonlySet<NodeId>,
  /** The nodes that left each container in the edit, by the container they
   *  left — removed, or moved out. */
  departures: ReadonlyMap<NodeId, readonly NodeId[]>,
) => ReadonlyMap<NodeId, TPose> | null;
