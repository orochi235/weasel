import type { OngoingHandle } from '@weasel-js/routing';
import type { EditAnchorsDep } from '../depSchema';
import type { PolygonPath } from '@weasel-js/geom';
import { storeEditablePath, type EditableShape } from 'features/paths/editablePath';

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
 *
 * The ghost is what committing `current` would store (`storeEditablePath`),
 * so a spiro curve is solved again on every move.
 */
export function pathEditPreview(
  dep: EditAnchorsDep,
  id: string,
  current: () => PolygonPath | null,
): PathEditPreview | null {
  const storageKind = dep.getStorageKind(id);
  if (storageKind !== 'pose' && storageKind !== 'data') return null;
  // The node as it was at the press, which every ghost is stored from. A dep
  // that hands out no shape still says a pose-stored polygon is the pose.
  const origin = dep.getNodeShape(id)
    ?? (storageKind === 'pose' ? { pose: dep.getEditablePath(id), data: undefined } : null);
  if (!origin) return null;

  // previewPose and previewData are both asked each frame; store once per path.
  let lastPath: PolygonPath | null = null;
  let lastStored: EditableShape | null = null;
  const stored = (pid: string): EditableShape | null => {
    const path = pid === id ? current() : null;
    if (!path) return null;
    if (path !== lastPath) {
      lastPath = path;
      lastStored = storeEditablePath(origin, path);
    }
    return lastStored;
  };

  return {
    storageKind,
    previewIds: () => (current() ? [id] : null),
    previewPose: (pid: string): unknown | null => stored(pid)?.pose ?? null,
    previewData: (pid: string): unknown | null => {
      const next = stored(pid);
      return next && next.data !== origin.data ? next.data : null;
    },
  };
}
