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
 * preview yet; `others`, the world-space paths of other nodes the edit moves
 * with it. Null when the node stores its path in neither supported place.
 *
 * The ghost is what committing `current` would store (`storeEditablePath`),
 * so a path drawn from a form is drawn again from the edited form on every
 * move.
 */
export function pathEditPreview(
  dep: EditAnchorsDep,
  id: string,
  current: () => PolygonPath | null,
  others: () => readonly { id: string; path: PolygonPath }[] = () => [],
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
      lastStored = storeEditablePath(origin, path, dep.extensions);
    }
    return lastStored;
  };

  // Another node's ghost, stored from that node as the press found it, once per path.
  const otherOrigins = new Map<string, EditableShape | null>();
  const otherStored = new Map<string, { path: PolygonPath; stored: EditableShape | null }>();
  const storedOther = (pid: string): { from: EditableShape; to: EditableShape } | null => {
    const path = others().find((o) => o.id === pid)?.path;
    if (!path) return null;
    if (!otherOrigins.has(pid)) otherOrigins.set(pid, dep.getNodeShape(pid));
    const from = otherOrigins.get(pid);
    if (!from) return null;
    let hit = otherStored.get(pid);
    if (hit?.path !== path) otherStored.set(pid, (hit = { path, stored: storeEditablePath(from, path, dep.extensions) }));
    return hit.stored ? { from, to: hit.stored } : null;
  };

  return {
    storageKind,
    previewIds: () => (current() ? [id, ...others().map((o) => o.id)] : null),
    previewPose: (pid: string): unknown | null =>
      (pid === id ? stored(pid)?.pose : storedOther(pid)?.to.pose) ?? null,
    previewData: (pid: string): unknown | null => {
      if (pid !== id) {
        const o = storedOther(pid);
        return o && o.to.data !== o.from.data ? o.to.data : null;
      }
      const next = stored(pid);
      return next && next.data !== origin.data ? next.data : null;
    },
  };
}
