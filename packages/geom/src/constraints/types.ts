/**
 * Geometric constraints on a path's anchors. Each names anchors by flat index,
 * the walk-order numbering `enumerateAnchors` and `anchorAt` use, and is plain
 * JSON, so a list of them can be kept in scene data and saved with it.
 */

/** Two anchors by flat index: the straight line from the first to the second. */
export type AnchorPair = readonly [number, number];

/**
 * One constraint. `fixed` holds an anchor where it was before an edit, so it
 * moves with its node but not with any edit of the path. `horizontal` and
 * `vertical` read the axes of the frame the solve is given; `length` is in
 * the path's own units. `tangent` keeps an anchor's two handles on one line
 * through it, pointing apart (G1 continuity), their lengths free; it needs
 * both handles. `onPath` holds an anchor on the path's segment from
 * `segment[0]` to `segment[1]`, anywhere along it.
 */
export type PathConstraint =
  | { readonly kind: 'fixed' | 'tangent'; readonly anchor: number }
  | { readonly kind: 'horizontal' | 'vertical'; readonly segment: AnchorPair }
  | {
    readonly kind: 'parallel' | 'perpendicular' | 'equalLength';
    readonly segments: readonly [AnchorPair, AnchorPair];
  }
  | { readonly kind: 'length'; readonly segment: AnchorPair; readonly length: number }
  | { readonly kind: 'coincident'; readonly anchors: AnchorPair }
  | { readonly kind: 'onPath'; readonly anchor: number; readonly segment: AnchorPair };

/** Every kind of {@link PathConstraint}. */
export type PathConstraintKind = PathConstraint['kind'];

/** The anchors `c` reads, in the order it names them; an anchor named twice is listed twice. */
export function constraintAnchors(c: PathConstraint): number[] {
  switch (c.kind) {
    case 'fixed':
    case 'tangent': return [c.anchor];
    case 'horizontal':
    case 'vertical':
    case 'length': return [...c.segment];
    case 'coincident': return [...c.anchors];
    case 'onPath': return [c.anchor, ...c.segment];
    default: return [...c.segments[0], ...c.segments[1]];
  }
}

/**
 * `c` with every anchor index passed through `to`, or null when `to` answers
 * `undefined` for any of them — the anchor is gone, and so is the constraint.
 */
export function mapConstraintAnchors(
  c: PathConstraint,
  to: (anchor: number) => number | undefined,
): PathConstraint | null {
  const pair = (p: AnchorPair): AnchorPair | null => {
    const a = to(p[0]);
    const b = to(p[1]);
    return a === undefined || b === undefined ? null : [a, b];
  };
  switch (c.kind) {
    case 'fixed':
    case 'tangent': {
      const anchor = to(c.anchor);
      return anchor === undefined ? null : { kind: c.kind, anchor };
    }
    case 'horizontal':
    case 'vertical': {
      const segment = pair(c.segment);
      return segment && { kind: c.kind, segment };
    }
    case 'length': {
      const segment = pair(c.segment);
      return segment && { kind: 'length', segment, length: c.length };
    }
    case 'coincident': {
      const anchors = pair(c.anchors);
      return anchors && { kind: 'coincident', anchors };
    }
    case 'onPath': {
      const anchor = to(c.anchor);
      const segment = pair(c.segment);
      return anchor === undefined || !segment ? null : { kind: 'onPath', anchor, segment };
    }
    default: {
      const first = pair(c.segments[0]);
      const second = pair(c.segments[1]);
      return first && second && { kind: c.kind, segments: [first, second] };
    }
  }
}

/** Whether every anchor `c` names is an index below `count`. */
export function constraintFits(c: PathConstraint, count: number): boolean {
  return constraintAnchors(c).every((i) => Number.isInteger(i) && i >= 0 && i < count);
}
