/** The pen continuing an existing node's open subpath: picking it up by an end, and writing it back. */
import { commitSelectionFrom } from '@weasel-js/core';
import type { ActionDeps } from '@weasel-js/routing';
import { editAnchorSetTracked, pathToAnchors, reverseAnchors, worldCoords, type PolygonPath } from '@weasel-js/geom';
import { buildPath } from './penScratch';
import { openEndNear } from './penTargets';
import type { PenScratch, PenSubpath } from './usePenTool';

/** From idle, a press on an open subpath's end anchor within `closePx` picks
 *  that subpath up: it becomes `current`, turned so the pressed end is last.
 *  Returns whether it did. */
export function pickUpEndpoint(s: PenScratch, deps: ActionDeps, wx: number, wy: number, closePx: number): boolean {
  if (s.current || s.finishedSubpaths.length > 0) return false;
  const hit = openEndNear(deps, wx, wy, closePx);
  if (!hit) return false;
  const original = deps.editAnchors!.getEditablePath(hit.id) as PolygonPath;
  const picked = pathToAnchors(original).anchors[hit.sub];
  const reversed = hit.end === 'first' && picked.length > 1;
  s.current = { anchors: reversed ? reverseAnchors(picked) : picked, closed: false };
  s.continuing = { id: hit.id, sub: hit.sub, reversed, original };
  return true;
}

/** Write the pen's subpaths back into the node it picked up: the first
 *  replaces the subpath it continued, any later ones are appended. Skips
 *  the write when nothing changed, so an empty pick-up leaves no undo
 *  entry. */
export function commitContinuation(s: PenScratch, trailing: PenSubpath | null, deps: ActionDeps, autoSelect: boolean): void {
  const edit = deps.editAnchors;
  const cont = s.continuing!;
  const drawn = [...s.finishedSubpaths, ...(trailing ? [trailing] : [])];
  if (!edit || drawn.length === 0) return;
  const { anchors: added, closed: addedClosed } = pathToAnchors(buildPath(drawn, null));
  if (cont.reversed) added[0] = reverseAnchors(added[0]);
  const next = editAnchorSetTracked(cont.original, (set) => {
    set.anchors.splice(cont.sub, 1, added[0]);
    set.closed.splice(cont.sub, 1, addedClosed[0]);
    set.anchors.push(...added.slice(1));
    set.closed.push(...addedClosed.slice(1));
  })!;
  if (samePath(next.path, cont.original)) return;
  edit.applyEdit(cont.id, next.path, 'Continue path', next.origins, autoSelect ? commitSelectionFrom(deps.operands) : undefined);
}

function samePath(a: PolygonPath, b: PolygonPath): boolean {
  const ac = worldCoords(a), bc = worldCoords(b);
  if (a.commands.length !== b.commands.length || ac.length !== bc.length) return false;
  for (let i = 0; i < a.commands.length; i++) if (a.commands[i] !== b.commands[i]) return false;
  return ac.every((v, i) => v === bc[i]);
}
