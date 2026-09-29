import type { NodeId } from './types';

/**
 * Thrown by a scene edit — `batch`, `untracked`, or a bare `add` / `move` —
 * whose arrivals the scene's arrival handler refused. The edit has already
 * been reverted when this reaches the caller. An op-driven edit
 * (`applyBatch`, `history.applyOps`, a journal's `applyBatch`) is reverted
 * the same way but does not throw: nothing lands, as with a drop onto a
 * container that takes none.
 */
export class SceneArrivalRefused extends Error {
  /** The nodes refused, by the container they were joining. */
  readonly arrivals: ReadonlyMap<NodeId, readonly NodeId[]>;

  constructor(arrivals: ReadonlyMap<NodeId, readonly NodeId[]>) {
    const where = [...arrivals.keys()].map((id) => `"${id}"`).join(', ');
    super(`Scene: ${where} refused the nodes joining it`);
    this.name = 'SceneArrivalRefused';
    this.arrivals = arrivals;
  }
}
