import type { OngoingHandle } from '@weasel-js/routing';
import type { EditAnchorsDep } from '../depSchema';
import { worldEditToStorage, type PolygonPath } from '@weasel-js/geom';

/** Where the edited polygon lives on its node: the pose itself, or `data.path`
 *  under a rect pose. */
export type PathStorageKind = 'pose' | 'data';

/** The preview half of an ongoing path edit, captured at press. */
export interface PathEditPreview {
  storageKind: PathStorageKind;
  previewIds: NonNullable<OngoingHandle['previewIds']>;
  previewPose: NonNullable<OngoingHandle['previewPose']>;
  previewData: NonNullable<OngoingHandle['previewData']>;
}

/**
 * Preview ghosts for a drag that reshapes the path in edit mode. `current`
 * answers the world-space polygon to show, or null while there is nothing to
 * preview yet. Null when the node stores its path in neither supported place.
 */
export function pathEditPreview(
  dep: EditAnchorsDep,
  id: string,
  current: () => PolygonPath | null,
): PathEditPreview | null {
  const storageKind = dep.getStorageKind(id);
  if (storageKind !== 'pose' && storageKind !== 'data') return null;
  // For data.path nodes, the original rect pose + data that previewPose /
  // previewData derive from, captured at start.
  const nodeShape = storageKind === 'data' ? dep.getNodeShape(id) : null;
  const originRectPose =
    nodeShape ? (nodeShape.pose as { x: number; y: number; width: number; height: number }) : undefined;
  const originData = nodeShape ? (nodeShape.data as object) : undefined;

  return {
    storageKind,
    previewIds: () => (current() ? [id] : null),
    previewPose: (pid: string): unknown | null => {
      const path = pid === id ? current() : null;
      if (!path) return null;
      // Pose IS the polygon — preview pose is the polygon itself.
      if (storageKind === 'pose') return path;
      // data.path: invert the world edit the same way the commit does, so
      // the preview ghost (which re-applies pose.rotation via the render
      // wrap) matches the committed result — no double-rotation.
      if (!originRectPose) return null;
      return worldEditToStorage(originRectPose, path).pose;
    },
    previewData: (pid: string): unknown | null => {
      const path = pid === id ? current() : null;
      if (!path || storageKind !== 'data' || !originData) return null;
      // Stored path is the unrotated, origin-aligned contour; the render
      // invariant `pathInWorld(stored, pose) === world` holds.
      return { ...originData, path: worldEditToStorage(originRectPose!, path).path };
    },
  };
}
