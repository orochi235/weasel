/** The `snap` dep: what a drawn or dragged point locks to. */

type Point = { x: number; y: number };

/** What a snap request knows about the gesture asking. Every field is
 *  optional, and a snapper that reads none of them answers the same. */
export interface SnapQuery {
  /** Where the geometry being drawn starts: a line's first end, the pen's
   *  last anchor, a move's base point. Tangent and perpendicular targets are
   *  measured from it. */
  origin?: Point;
  /** Nodes whose geometry offers no targets — what the gesture is moving. */
  exclude?: readonly string[];
  /** Only these nodes' geometry offers targets. */
  include?: readonly string[];
}

/**
 * World-space point snapping — grid, guides, path geometry, or any consumer
 * rule. Actions apply it to the coords they ingest so the live preview and
 * the committed geometry agree.
 */
export interface SnapDep {
  /** Snap a world-space point. Return `p` unchanged to opt out. */
  point(p: Point, at?: SnapQuery): Point;
  /** Snap `p` to path geometry alone, or null when no target is in range.
   *  A move and an anchor drag read this, so a grid that the drawing tools
   *  follow does not start pulling dragged shapes too. */
  toPaths?(p: Point, at?: SnapQuery): Point | null;
  /** The gesture that asked is over: drop whatever marks its last snap. */
  release?(): void;
}
