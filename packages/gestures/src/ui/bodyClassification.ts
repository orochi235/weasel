/**
 * Body-target classification from the scene hit-test. Populated by
 * `useGestureDispatcher` when a `classifyTarget` thunk is supplied to its
 * options, and read by `matchTarget` to resolve string-form `TargetSpec`
 * values. Absent when `classifyTarget` is not wired.
 */
export type BodyTarget = 'empty' | 'selected-body' | 'unselected-body';

/**
 * Semantic kind of the node body under the point — `'text'`, `'rect'`, or an
 * app's own `'app:note'`. Companion to {@link BodyTarget}, which says only how
 * the body relates to the selection. Supplied by the same `classifyTarget`
 * thunk; an absent `bodyKind` makes every `kind:` form no-match, never a
 * wildcard.
 */
export type BodyKind = string;

/**
 * What a scene hit-test found under a point — the shape a `classifyTarget`
 * thunk returns, and the source of both {@link BodyTarget} and
 * {@link BodyKind} on the events the matcher sees.
 */
export interface BodyClassification {
  /** How the hit body relates to the current selection. */
  body: BodyTarget;
  /** Semantic kind of the hit body. Undefined on empty canvas, and undefined
   *  on a body whose kind the scene can't name — never guessed. */
  kind?: BodyKind;
  /** The node classified. Matching ignores it. */
  id?: string;
  /** What a double-click at this point names, where that is not the body hit: the group a hit
   *  member belongs to. A double click's targets match against it. Absent, the hit is named. */
  doubleClick?: { body: BodyTarget; kind?: BodyKind; id?: string };
}

/** The body a double-click names, as a press carries it to the double click it composes. */
export interface DoubleClickBody {
  bodyTarget: BodyTarget;
  bodyKind?: BodyKind;
}
