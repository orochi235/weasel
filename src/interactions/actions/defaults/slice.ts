// src/interactions/actions/defaults/slice.ts
import type { Point2 } from '../invoker';

/**
 * Consumer-supplied commit for the Slice action. `commit` receives the finite
 * slice segment (world coords); the consumer scans the scene, splits crossed
 * paths via `splitPathByLine`, and applies the result as one undoable batch.
 */
export interface SliceDep {
  commit(a: Point2, b: Point2): void;
}
