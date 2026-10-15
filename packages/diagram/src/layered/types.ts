/** What the layered steps hand one another. */
import type { GraphNode } from '../graph';

/** One rank's worth of an edge: from a node or placeholder in rank `r` to one
 *  in rank `r + 1`. An edge spanning several ranks is a chain of these. */
export interface Hop {
  from: string;
  to: string;
  /** The graph edge this hop is part of. */
  edge: string;
}

/** A rank's members in order. A placeholder is a `GraphNode` whose id starts
 *  with {@link PLACEHOLDER}; its `group` is set only when both ends of its
 *  edge are inside that group. */
export type Rows = GraphNode[][];

/** Every placeholder id starts with this. A NUL is not something a scene id
 *  carries, so a placeholder cannot collide with a node. */
export const PLACEHOLDER = '\u0000hop:';

/** Whether an id names a placeholder rather than a node. */
export const isPlaceholder = (id: string): boolean => id.startsWith(PLACEHOLDER);
