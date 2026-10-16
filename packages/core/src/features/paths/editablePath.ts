/**
 * A node's editable polygon. It lives in one of two places: the pose itself
 * (`pose.kind === 'polygon'`), or `data.path` with a rect pose, stored pose-local.
 * A rect `data.path` is edited as its four corners and is stored as a polygon
 * from the first edit on; reading it changes nothing.
 */
import { asPolygonPath, pathInWorld, worldEditToStorage, type Path, type PolygonPath } from '@weasel-js/geom';
import type { GesturePreviewSource } from 'canvas/gestureBounds';
import { pathFromPlane } from 'canvas/planeClips';
import { isRectPose } from 'core/geometry/autoPoseDescriptor';
import type { RectPose } from 'core/scene/types';
import type { PlaneMap } from 'core/viewport/parallax';

/** The two fields of a node the editable path is read from. */
export interface EditableShape {
  pose: unknown;
  data: unknown;
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
 * The pose and data that store `worldPath` where `node` stores its editable
 * polygon — the inverse of {@link resolveEditablePathOf}, so a `data.path`
 * node keeps its rotation. Null when `node` has no editable polygon.
 */
export function storeEditablePath(
  node: EditableShape | undefined | null,
  worldPath: PolygonPath,
): EditableShape | null {
  const storage = classifyPathStorage(node);
  if (!storage) return null;
  if (storage.kind === 'pose') return { pose: worldPath, data: node!.data };
  const { pose, path } = worldEditToStorage(storage.pose, worldPath);
  return { pose, data: { ...storage.data, path } };
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
  return { pose, data };
}

/**
 * The editable polygon of node `id` as it is drawn right now: following any
 * in-flight gesture in `previews`, and in the world of the camera whose
 * `plane` this is — a path on a parallax plane is stored in the plane's.
 */
export function liveEditablePath(
  id: string,
  node: EditableShape | undefined | null,
  previews: readonly GesturePreviewSource[],
  plane: PlaneMap | null,
): PolygonPath | null {
  if (!node) return null;
  return pathFromPlane(resolveEditablePathOf(previewedShape(id, node, previews)), plane);
}
