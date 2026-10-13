/**
 * A node's editable polygon. It lives in one of two places: the pose itself
 * (`pose.kind === 'polygon'`), or `data.path` with a rect pose, stored pose-local.
 */
import { pathInWorld, type Path, type PolygonPath } from '@weasel-js/geom';
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
 *  node has neither a polygon pose nor a polygon on `data.path`. */
export function classifyPathStorage(
  node: EditableShape | undefined | null,
): { kind: 'pose' } | { kind: 'data'; pose: RectPose; data: { path: PolygonPath } } | null {
  if (!node) return null;
  const pose = node.pose as { kind?: string } | undefined;
  if (pose?.kind === 'polygon') return { kind: 'pose' };
  const data = node.data as { path?: Path } | null;
  if (data?.path && (data.path as { kind?: string }).kind === 'polygon' && isRectPose(node.pose)) {
    return {
      kind: 'data',
      pose: node.pose,
      data: data as { path: PolygonPath },
    };
  }
  return null;
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
