/**
 * A node's editable polygon. It lives in one of two places: the pose itself
 * (`pose.kind === 'polygon'`), or `data.path` with a rect pose, stored pose-local.
 * A rect `data.path` is edited as its four corners and is stored as a polygon
 * from the first edit on; reading it changes nothing. A leaf drawn as its rect
 * pose alone reads as a rect `data.path` the size of its pose, and gains one
 * on the first edit.
 */
import { asPolygonPath, pathInWorld, rectPath, worldEditToStorage, type Path, type PolygonPath } from '@weasel-js/geom';
import type { GesturePreviewSource } from 'canvas/gestureBounds';
import { findNodeShape } from 'canvas/NodeShape';
import { RECT_FALLBACK_PAINTER } from 'canvas/nodeShapes/rectFallbackPainter';
import { pathFromPlane } from 'canvas/planeClips';
import { isRectPose } from 'core/geometry/autoPoseDescriptor';
import type { RectPose } from 'core/scene/types';
import type { PlaneMap } from 'core/viewport/parallax';
import type { PathEditExtension } from './pathEditExtension';
import { pathFormOf, representationOf, withoutPathForm, type AnchorMarkerShape } from './pathRepresentation';

/** The fields of a node the editable path is read from. A node's `kind`
 *  says whether a rect pose with no path is a leaf drawn as that rect. */
export interface EditableShape {
  pose: unknown;
  data: unknown;
  kind?: string;
}

/** Whether `node` is a leaf whose only geometry is its rect pose, drawn by
 *  the kit's rect fallback. */
function drawsPoseAlone(node: EditableShape): boolean {
  if (node.kind !== 'leaf' || (node.data as { path?: unknown } | null)?.path != null) return false;
  return findNodeShape(node as never) === RECT_FALLBACK_PAINTER;
}

/** Resolve where a node's editable polygon lives. Returns null when the
 *  node has neither a polygon pose nor a polygon or rect on `data.path`.
 *  A rect comes back as the polygon it draws. */
export function classifyPathStorage(
  node: EditableShape | undefined | null,
): { kind: 'pose' } | { kind: 'data'; pose: RectPose; data: { path: PolygonPath } } | null {
  if (!node) return null;
  const pose = node.pose as { kind?: string } | undefined;
  if (pose?.kind === 'polygon') return { kind: 'pose' };
  if (isRectPose(node.pose) && drawsPoseAlone(node)) {
    const { width, height } = node.pose;
    return { kind: 'data', pose: node.pose, data: { ...(node.data as object), path: asPolygonPath(rectPath(0, 0, width, height)) } };
  }
  const data = node.data as { path?: Path } | null;
  const kind = (data?.path as { kind?: string } | undefined)?.kind;
  if (!data?.path || (kind !== 'polygon' && kind !== 'rect') || !isRectPose(node.pose)) return null;
  const path = asPolygonPath(data.path);
  return {
    kind: 'data',
    pose: node.pose,
    data: (path === data.path ? data : { ...data, path }) as { path: PolygonPath },
  };
}

/** Whether `node` has a path that path edit can show anchors for. */
export function hasEditablePath(node: EditableShape | undefined | null): boolean {
  return classifyPathStorage(node) !== null;
}

/** A node's editable polygon in world coords. Does NOT consult any preview state —
 *  callers that want live state read in-flight handles themselves. */
export function resolveEditablePathOf(
  node: EditableShape | undefined | null,
): PolygonPath | null {
  if (!node) return null;
  const storage = classifyPathStorage(node);
  if (!storage) return null;
  // Pose-as-polygon: the pose IS the polygon (polygon poses can't carry
  // rotation), so it's already world.
  if (storage.kind === 'pose') return (node as { pose: PolygonPath }).pose;
  // data.path: translate to the pose origin AND bake `pose.rotation`, so anchors render on
  // the rotated contour the renderer draws.
  return pathInWorld(storage.data.path, storage.pose) as PolygonPath;
}

/**
 * What path edit edits on a node, in world coords: the edit path of the form
 * the node's path was drawn from, where one of `extensions` reads it
 * (`PathRepresentation`), and otherwise its editable polygon. Null when the
 * node has no editable polygon.
 */
export function pathEditPathOf(
  node: EditableShape | undefined | null,
  extensions: readonly PathEditExtension[] = [],
): PolygonPath | null {
  const path = resolveEditablePathOf(node);
  const held = path ? representationOf(extensions, node!.data) : null;
  return (held && held.representation.editPath(path!, held.form)) ?? path;
}

/**
 * The pose and data that store `worldPath` where `node` stores its editable
 * polygon — the inverse of {@link resolveEditablePathOf}, so a `data.path`
 * node keeps its rotation. On a node whose path was drawn from a form one of
 * `extensions` reads, `worldPath` is an edit of what {@link pathEditPathOf}
 * gave, and the representation turns it into the drawn path; a form none
 * reads, or that no longer describes the path, is dropped. Null when `node`
 * has no editable polygon.
 */
export function storeEditablePath(
  node: EditableShape | undefined | null,
  worldPath: PolygonPath,
  extensions: readonly PathEditExtension[] = [],
): EditableShape | null {
  const storage = classifyPathStorage(node);
  if (!storage) return null;
  let path = worldPath;
  let data = node!.data;
  if (pathFormOf(data)) {
    const held = representationOf(extensions, data);
    const solved = held ? held.representation.store(resolveEditablePathOf(node)!, held.form, worldPath) : null;
    path = solved?.path ?? worldPath;
    data = solved ? { ...(data as object), representation: solved.form } : withoutPathForm(data);
  }
  if (storage.kind === 'pose') return { pose: path, data };
  const stored = worldEditToStorage(storage.pose, path);
  return { pose: stored.pose, data: { ...(data as object), path: stored.path } };
}

/** `node` as the in-flight gestures in `previews` would leave it: a handle
 *  previewing `id` contributes its pose and its data. */
function previewedShape(
  id: string,
  node: EditableShape,
  previews: readonly GesturePreviewSource[],
): EditableShape {
  let pose = node.pose;
  let data = node.data;
  let touched = false;
  const kind = node.kind;
  for (const source of previews) {
    const previewIds = source.previewIds?.();
    if (!previewIds) continue;
    let owns = false;
    for (const pid of previewIds) {
      if (pid === id) { owns = true; break; }
    }
    if (!owns) continue;
    const p = source.previewPose?.(id);
    if (p != null && !touched) { pose = p; touched = true; }
    const d = source.previewData?.(id);
    if (d != null) { data = d; touched = true; }
  }
  return { pose, data, kind };
}

/**
 * What path edit shows of node `id` right now ({@link pathEditPathOf}): following any
 * in-flight gesture in `previews`, and in the world of the camera whose
 * `plane` this is — a path on a parallax plane is stored in the plane's.
 */
export function liveEditablePath(
  id: string,
  node: EditableShape | undefined | null,
  previews: readonly GesturePreviewSource[],
  plane: PlaneMap | null,
  extensions: readonly PathEditExtension[] = [],
): PolygonPath | null {
  if (!node) return null;
  return pathFromPlane(pathEditPathOf(previewedShape(id, node, previews), extensions), plane);
}

/** The marker of each anchor {@link liveEditablePath} shows for node `id`, as
 *  the representation reading its form draws them; null for a node it reads
 *  none of. */
export function liveAnchorMarkers(
  id: string,
  node: EditableShape | undefined | null,
  previews: readonly GesturePreviewSource[],
  extensions: readonly PathEditExtension[],
): readonly (AnchorMarkerShape | null)[] | null {
  if (!node) return null;
  const held = representationOf(extensions, previewedShape(id, node, previews).data);
  return held?.representation.anchorMarkers?.(held.form) ?? null;
}
