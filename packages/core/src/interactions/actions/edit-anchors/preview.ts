import type { OngoingHandle } from '@weasel-js/routing';
import type { EditAnchorsDep } from '../depSchema';
import type { FinishedEditFrame } from '../editAnchorsDep';
import type { PointOrigin, PolygonPath } from '@weasel-js/geom';
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

/** One frame of a drag that reshapes the path in edit mode: the world-space
 *  polygon it makes, and where each of its points came from when the drag
 *  knows (`editAnchorSetTracked`). */
export interface PathEditFrame {
  path: PolygonPath;
  origins?: readonly (PointOrigin | null)[];
}

type ShownFrame = { path: PolygonPath; others: readonly { id: string; path: PolygonPath }[] };

/** `path`, a frame of an edit of `id`, finished by the dep's `finishEdit` as
 *  committing it would be: its path and the other nodes' that move with it.
 *  Null when an extension cannot finish it. */
export function finishPathEditFrame(
  dep: EditAnchorsDep,
  id: string,
  path: PolygonPath,
  origins?: readonly (PointOrigin | null)[],
): FinishedEditFrame | null {
  return dep.finishEdit ? dep.finishEdit(id, path, origins) : { path, others: [] };
}

/**
 * Preview ghosts for a drag that reshapes the path in edit mode. `current`
 * answers the frame to show, or null while there is nothing to preview yet.
 * Each frame is finished as committing it would be
 * ({@link finishPathEditFrame}), so the node's constraints and the nodes
 * linked to it show as they will commit; a frame that cannot be finished
 * commits nothing, and shows nothing. A drag that finishes its own frames
 * passes `finished`, the world-space paths of the other nodes its frame
 * moves, and its frames are shown as they are. Null when the node stores its
 * path in neither supported place.
 *
 * The ghost is what committing the frame would store (`storeEditablePath`),
 * so a path drawn from a form is drawn again from the edited form on every
 * move.
 */
export function pathEditPreview(
  dep: EditAnchorsDep,
  id: string,
  current: () => PathEditFrame | null,
  finished?: () => readonly { id: string; path: PolygonPath }[],
): PathEditPreview | null {
  const storageKind = dep.getStorageKind(id);
  if (storageKind !== 'pose' && storageKind !== 'data') return null;
  // The node as it was at the press, which every ghost is stored from. A dep
  // that hands out no shape still says a pose-stored polygon is the pose.
  const origin = dep.getNodeShape(id)
    ?? (storageKind === 'pose' ? { pose: dep.getEditablePath(id), data: undefined } : null);
  if (!origin) return null;

  // Each frame is finished once, however many times the dispatcher asks for it.
  let lastFrame: PolygonPath | null = null;
  let lastFinished: ShownFrame | null = null;
  const shown = (): ShownFrame | null => {
    const frame = current();
    if (!frame) return null;
    if (finished) return { path: frame.path, others: finished() };
    if (frame.path !== lastFrame) {
      lastFrame = frame.path;
      lastFinished = finishPathEditFrame(dep, id, frame.path, frame.origins) as ShownFrame | null;
    }
    return lastFinished;
  };
  const others = () => shown()?.others ?? [];

  // previewPose and previewData are both asked each frame; store once per path.
  let lastPath: PolygonPath | null = null;
  let lastStored: EditableShape | null = null;
  const stored = (pid: string): EditableShape | null => {
    const path = pid === id ? shown()?.path : null;
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
    previewIds: () => {
      const frame = shown();
      return frame ? [id, ...frame.others.map((o) => o.id)] : null;
    },
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
