/**
 * A path drawn from another form the node keeps beside it, such as a curve
 * solved through the points it passes. The node's path stays the geometry
 * every reader draws and hit-tests; `data.representation` holds the form,
 * named by its `kind`. A preset that knows a kind brings a
 * {@link PathRepresentation} for it (`PathEditExtension.representation`),
 * through which path edit shows and edits the form. Where none is on, path
 * edit edits the drawn path, and the edit drops the form.
 */
import type { ActionDeps, OngoingHandle } from '@weasel-js/routing';
import type { PolygonPath } from '@weasel-js/geom';
import type { PathEditExtension } from './pathEditExtension';

/** What `data.representation` holds: a form named by `kind`, with whatever
 *  that kind keeps. */
export interface PathForm {
  readonly kind: string;
  readonly [field: string]: unknown;
}

type Point = { x: number; y: number };

/** The outline of an anchor's marker, in screen space: `size` px across at
 *  `at`, with the anchor's neighbors along its subpath, null past an open
 *  end. */
export type AnchorMarkerShape = (at: Point, size: number, prev: Point | null, next: Point | null) => PolygonPath;

/** How path edit reads and writes one kind of {@link PathForm}. */
export interface PathRepresentation {
  /** The `kind` of the forms it reads. */
  readonly kind: string;
  /** What path edit shows and moves for a node holding `form`, whose drawn
   *  path in world space is `path`. Null when `form` does not describe
   *  `path`: path edit then edits `path`, and the edit drops the form. */
  editPath(path: PolygonPath, form: PathForm): PolygonPath | null;
  /**
   * The drawn path an edit makes, and the form to keep beside it: `edited` is
   * an edit of what {@link editPath} gave, `path` the drawn path it was given
   * from. Null when `form` does not describe `path`; the edit is then stored
   * as drawn, without the form. Runs on every commit of an edit and every
   * frame of one in flight.
   */
  store(path: PolygonPath, form: PathForm, edited: PolygonPath): { path: PolygonPath; form: PathForm } | null;
  /** The marker of each anchor of the edit path, by flat index. An anchor
   *  with none draws path edit's square. */
  anchorMarkers?(form: PathForm): readonly (AnchorMarkerShape | null)[];
  /**
   * A press at world point `at` on the drawn outline of the node in path
   * edit: the drag it starts, or null when it starts none there. A
   * representation that has this takes every segment press, in place of
   * Bend segment.
   */
  segmentPress?(deps: ActionDeps, at: Point): (() => OngoingHandle) | null;
}

/** The form `data` holds, or null. */
export function pathFormOf(data: unknown): PathForm | null {
  const form = (data as { representation?: unknown } | null | undefined)?.representation;
  return form && typeof form === 'object' && typeof (form as { kind?: unknown }).kind === 'string'
    ? (form as PathForm)
    : null;
}

/** `data` without its form: its path as plain geometry. */
export function withoutPathForm<T>(data: T): T {
  if (data === null || typeof data !== 'object' || !('representation' in data)) return data;
  const { representation: _dropped, ...rest } = data as Record<string, unknown>;
  void _dropped;
  return rest as T;
}

/** The form `data` holds, and the representation among `extensions` that
 *  reads it; null when either is missing. */
export function representationOf(
  extensions: readonly PathEditExtension[] | undefined,
  data: unknown,
): { representation: PathRepresentation; form: PathForm } | null {
  const form = pathFormOf(data);
  if (!form || !extensions) return null;
  const representation = extensions.find((e) => e.representation?.kind === form.kind)?.representation;
  return representation ? { representation, form } : null;
}
