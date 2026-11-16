/** Path edit's side of the marks its extensions draw: finding the one a click
 *  lands on, and deleting the selected one. */

import type { ActionDeps } from '@weasel-js/routing';
import { pathToAnchors, viewWorldToScreen, type AnchorSet, type PolygonPath } from '@weasel-js/geom';
import type { EditAnchorsDep, PathEditMark, PathEditTarget } from '@weasel-js/core';

/** The open path as extensions read it, or null with none open. */
export function editTargetOf(dep: EditAnchorsDep): PathEditTarget | null {
  const node = dep.editingId ? dep.getNodeShape(dep.editingId) : null;
  const path = node ? (dep.getEditablePath(dep.editingId) as PolygonPath | null | undefined) : null;
  if (!node || path?.kind !== 'polygon') return null;
  return { id: dep.editingId, node, path, anchors: pathToAnchors(path) as AnchorSet };
}

/** The extension mark under the world point `(wx, wy)`, or null. */
export function markUnder(dep: EditAnchorsDep, deps: ActionDeps | undefined, wx: number, wy: number): PathEditMark | null {
  const extensions = dep.extensions?.filter((e) => e.markAt) ?? [];
  const target = extensions.length > 0 ? editTargetOf(dep) : null;
  if (!target) return null;
  const view = deps?.view?.get() ?? { x: 0, y: 0, scale: { x: 1, y: 1 } };
  const toScreen = (p: { x: number; y: number }) => viewWorldToScreen(view, p);
  const screen = toScreen({ x: wx, y: wy });
  for (const ext of [...extensions].reverse()) {
    const index = ext.markAt!(target, toScreen, screen);
    if (index !== -1) return { owner: ext.id, index };
  }
  return null;
}

/** How the selected extension mark would be deleted, or null when none is selected or its owner cannot delete it. */
function selectedMarkDelete(dep: EditAnchorsDep): (() => void) | null {
  const mark = dep.selectedMark;
  const owner = mark ? dep.extensions?.find((e) => e.id === mark.owner) : undefined;
  const target = owner?.deleteMark && dep.store ? editTargetOf(dep) : null;
  if (!mark || !target) return null;
  return () => owner!.deleteMark!(target, mark.index, dep.store!);
}

/** Whether {@link deleteSelectedMark} would delete a mark. */
export function canDeleteSelectedMark(dep: EditAnchorsDep): boolean {
  return selectedMarkDelete(dep) !== null;
}

/** Delete the selected extension mark. False when none is selected, or its
 *  owner cannot delete it. */
export function deleteSelectedMark(dep: EditAnchorsDep): boolean {
  const del = selectedMarkDelete(dep);
  if (!del) return false;
  del();
  dep.setSelectedMark?.(null);
  return true;
}
