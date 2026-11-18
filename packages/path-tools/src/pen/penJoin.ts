/** The pen finishing a path by joining it onto another open subpath's end. */
import { commitOps, createDeleteOp, resolveEditablePathOf, type Op } from '@weasel-js/core';
import type { ActionDeps } from '@weasel-js/routing';
import { anchorsToPath, boundsOfPath, editAnchorSetTracked, pathToAnchors, reverseAnchors, type PathAnchorHit, type PolygonPath } from '@weasel-js/geom';
import type { PenCommitSettings } from './penCommit';
import { penOptionValues } from './penOptions';
import { buildPath, resetScratch } from './penScratch';
import type { PenScratch } from './usePenTool';

/** Whether an anchor about to land on `hit` finishes the path by joining
 *  onto another open subpath. Its own continued subpath never counts —
 *  reaching that one's far end is a close. Declines when the deps can't
 *  commit the join as one op batch. */
export function joinable(s: PenScratch, deps: ActionDeps, hit: PathAnchorHit | null): hit is PathAnchorHit {
  if (!hit || hit.end === null || !s.current || s.current.anchors.length === 0) return false;
  const cont = s.continuing;
  if (cont && hit.id === cont.id && hit.sub === cont.sub) return false;
  const scene = deps.scene;
  if (!scene && !deps.applyOps) return false;
  if (!(cont ? deps.editAnchors?.editOps : deps.insert?.build)) return false;
  return cont?.id === hit.id || scene?.get(hit.id as never) !== undefined;
}

/** Finish the path onto `hit`, the endpoint its last anchor was just placed
 *  on: the other subpath's anchors follow on from it, turned around when
 *  `hit` is its last anchor, and its node is deleted. The path being drawn
 *  keeps its identity — a continued node keeps its id and style, and a new
 *  path is minted the way any pen path is. One op batch, so one undo. */
export function commitJoin(
  s: PenScratch,
  deps: ActionDeps,
  hit: PathAnchorHit,
  settings: PenCommitSettings,
): void {
  const edit = deps.editAnchors!;
  const scene = deps.scene;
  const current = s.current!;
  const { anchors: added, closed: addedClosed } = pathToAnchors(buildPath([...s.finishedSubpaths, current], null));

  const other = (resolveEditablePathOf(scene?.get(hit.id as never)) ?? edit.getEditablePath(hit.id)) as PolygonPath;
  const otherSet = pathToAnchors(other);
  const tail = hit.end === 'last' ? reverseAnchors(otherSet.anchors[hit.sub]) : otherSet.anchors[hit.sub];
  const joined = added[added.length - 1];
  const joint = joined[joined.length - 1];
  const out = current.anchors[current.anchors.length - 1].outHandle ?? tail[0].outHandle;
  if (out) joint.outHandle = { ...out };
  joined.push(...tail.slice(1));

  const cont = s.continuing;
  const sameNode = cont?.id === hit.id;
  const rest = sameNode ? { anchors: [], closed: [] } : {
    anchors: otherSet.anchors.filter((_, i) => i !== hit.sub),
    closed: otherSet.closed.filter((_, i) => i !== hit.sub),
  };
  const label = 'Join paths';
  const ops: Op[] = [];
  let keptId: string;
  if (cont) {
    if (cont.reversed) added[0] = reverseAnchors(added[0]);
    const next = editAnchorSetTracked(cont.original, (set) => {
      set.anchors.splice(cont.sub, 1, added[0]);
      set.closed.splice(cont.sub, 1, addedClosed[0]);
      set.anchors.push(...added.slice(1), ...rest.anchors);
      set.closed.push(...addedClosed.slice(1), ...rest.closed);
      if (!sameNode) return;
      set.anchors.splice(hit.sub, 1);
      set.closed.splice(hit.sub, 1);
    })!;
    ops.push(...edit.editOps!(cont.id, next.path, label, next.origins));
    keptId = cont.id;
  } else {
    const path = anchorsToPath([...added, ...rest.anchors], [...addedClosed, ...rest.closed]);
    const built = deps.insert!.build!(boundsOfPath(path), { kind: 'path', path, closed: false, style: penOptionValues(settings.toolOptions, deps).style });
    if (built === null) return;
    ops.push(...built.ops);
    keptId = built.id;
  }
  if (!sameNode) ops.push(createDeleteOp({ node: scene!.get(hit.id as never) as { id: string } }));

  commitOps(deps, ops, label, settings.autoSelect ? { select: [keptId] } : {});
  resetScratch(s);
}
