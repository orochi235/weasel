/**
 * A spiro node: a path node whose `data.representation` is a spiro form,
 * saying its `data.path` is a solved spiro curve and which of the path's
 * anchors are the curve's points (`spiroToPath`). The path stays the geometry
 * every reader uses; path edit edits the points instead, through the
 * straight-sided control path, and each edit solves the curve again
 * (`spiroRepresentation`). Converting to a path drops the form.
 */
import {
  isSpiroKind,
  spiroContoursFromControl,
  spiroContoursOf,
  spiroControlPath,
  spiroToPath,
  type PolygonPath,
  type SpiroContour,
  type SpiroKind,
} from '@weasel-js/geom';

/** The `kind` of a spiro form. */
export const SPIRO_FORM = 'spiro';

/** A spiro form, as `data.representation` holds it: each point's kind, and
 *  the anchor of `data.path` it became. */
export type SpiroShape = {
  kind: typeof SPIRO_FORM;
  kinds: SpiroKind[];
  at: number[];
};

/** `form` as a spiro form, or null when it is not a well-formed one. */
export function asSpiro(form: unknown): SpiroShape | null {
  const s = form as Partial<SpiroShape> | null | undefined;
  if (!s || s.kind !== SPIRO_FORM || !Array.isArray(s.kinds) || !Array.isArray(s.at)) return null;
  if (s.kinds.length !== s.at.length) return null;
  if (!s.kinds.every(isSpiroKind) || !s.at.every((i) => Number.isInteger(i))) return null;
  return s as SpiroShape;
}

/** The spiro form a node's `data` holds, or `null`. */
export function spiroOf(data: unknown): SpiroShape | null {
  return asSpiro((data as { representation?: unknown } | null | undefined)?.representation);
}

/** `data` without its spiro form: the curve as plain geometry. */
export function withoutSpiro<T>(data: T): T {
  if (!spiroOf(data)) return data;
  const { representation: _dropped, ...rest } = data as Record<string, unknown>;
  void _dropped;
  return rest as T;
}

const shapeOf = (kinds: SpiroKind[], at: number[]): SpiroShape => ({ kind: SPIRO_FORM, kinds, at });

/** The node data a solved spiro curve is stored as: its path, and the form
 *  that says which anchors are points. */
export function spiroNodeData(
  contours: readonly SpiroContour[],
  like?: PolygonPath,
): { path: PolygonPath; representation: SpiroShape } {
  const { path, at } = spiroToPath(contours, { like });
  return { path, representation: shapeOf(contours.flatMap((c) => c.points.map((p) => p.kind)), at) };
}

/** The contours `spiro` reads out of `path`, or null when it does not
 *  describe it. */
export function spiroContours(path: PolygonPath, spiro: SpiroShape): SpiroContour[] | null {
  return spiroContoursOf(path, spiro.kinds, spiro.at);
}

/** The straight-sided path through `spiro`'s points on `path`: what path
 *  edit shows and moves. Null when `spiro` does not describe `path`. */
export function spiroEditPath(path: PolygonPath, spiro: SpiroShape): PolygonPath | null {
  const contours = spiroContours(path, spiro);
  return contours ? spiroControlPath(contours) : null;
}

/**
 * The curve an edit of the control path makes, solved through its anchors:
 * `control` is the edited control path, `path` the curve it was edited from.
 * Each point keeps its kind (`spiroContoursFromControl`). Null when `spiro`
 * does not describe `path`.
 */
export function respiro(
  path: PolygonPath,
  spiro: SpiroShape,
  control: PolygonPath,
): { path: PolygonPath; spiro: SpiroShape } | null {
  const before = spiroContours(path, spiro);
  if (!before) return null;
  const solved = spiroNodeData(spiroContoursFromControl(control, before), path);
  return { path: solved.path, spiro: solved.representation };
}

/** The curve `path` makes with the points at `flatIndexes` set to `kind`. Null
 *  when `spiro` does not describe `path`, or no kind changes. */
export function respiroWithKind(
  path: PolygonPath,
  spiro: SpiroShape,
  flatIndexes: Iterable<number>,
  kind: SpiroKind,
): { path: PolygonPath; spiro: SpiroShape } | null {
  const contours = spiroContours(path, spiro);
  if (!contours) return null;
  const picked = new Set(flatIndexes);
  let i = 0;
  let changed = false;
  const next = contours.map((c) => ({
    closed: c.closed,
    points: c.points.map((p) => {
      const hit = picked.has(i++) && p.kind !== kind;
      changed ||= hit;
      return hit ? { ...p, kind } : p;
    }),
  }));
  if (!changed) return null;
  const solved = spiroNodeData(next, path);
  return { path: solved.path, spiro: solved.representation };
}
