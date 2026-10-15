/**
 * A spiro node: a path node whose `data.spiro` says its `data.path` is a
 * solved spiro curve, and which of the path's anchors are the curve's points
 * (`spiroToPath`). The path stays the geometry every reader uses; path edit
 * edits the points instead, through the straight-sided control path, and each
 * edit solves the curve again. Converting to a path drops `data.spiro`.
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

/** What `data.spiro` holds: each point's kind, and the anchor of `data.path`
 *  it became. */
export interface SpiroShape {
  kinds: SpiroKind[];
  at: number[];
}

/** The spiro a node's `data` holds, or `null`. */
export function spiroOf(data: unknown): SpiroShape | null {
  const s = (data as { spiro?: unknown } | null | undefined)?.spiro as Partial<SpiroShape> | undefined;
  if (!s || !Array.isArray(s.kinds) || !Array.isArray(s.at) || s.kinds.length !== s.at.length) return null;
  if (!s.kinds.every(isSpiroKind) || !s.at.every((i) => Number.isInteger(i))) return null;
  return s as SpiroShape;
}

/** `data` without its spiro: the curve as plain geometry. */
export function withoutSpiro<T>(data: T): T {
  if (data === null || typeof data !== 'object' || !('spiro' in data)) return data;
  const { spiro: _dropped, ...rest } = data as Record<string, unknown>;
  void _dropped;
  return rest as T;
}

/** The node data a solved spiro curve is stored as: its path, and the spiro
 *  that says which anchors are points. */
export function spiroNodeData(contours: readonly SpiroContour[], like?: PolygonPath): { path: PolygonPath; spiro: SpiroShape } {
  const { path, at } = spiroToPath(contours, { like });
  return { path, spiro: { kinds: contours.flatMap((c) => c.points.map((p) => p.kind)), at } };
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
  return spiroNodeData(spiroContoursFromControl(control, before), path);
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
  return changed ? spiroNodeData(next, path) : null;
}
