/** Committing what the pen drew: a new path node, or the node it continued. */
import { boundsOfPath } from '@weasel-js/geom';
import { commitSelectionFrom } from '@weasel-js/core';
import type { ActionDeps, ToolOptionsSpec } from '@weasel-js/routing';
import { commitContinuation } from './penContinuation';
import { penOptionValues } from './penOptions';
import { buildPath, resetScratch } from './penScratch';
import type { PenScratch } from './usePenTool';

/** What a commit reads from the tool's options at the moment it runs. */
export interface PenCommitSettings {
  autoSelect: boolean;
  toolOptions: ToolOptionsSpec;
}

/** Commit the scratch and clear it. A continued node takes the drawing back;
 *  otherwise a path node is inserted through the `insert` dep, unless all
 *  that was drawn is one open anchor. */
export function commitPen(s: PenScratch, deps: ActionDeps, settings: PenCommitSettings): void {
  const trailing = s.current && s.current.anchors.length > 0 ? s.current : null;
  if (s.continuing) {
    commitContinuation(s, trailing, deps, settings.autoSelect);
    resetScratch(s);
    return;
  }
  // One anchor draws nothing; committing it would leave an invisible node.
  const open = trailing && trailing.anchors.length >= 2 ? trailing : null;
  if (s.finishedSubpaths.length === 0 && !open) {
    resetScratch(s);
    return;
  }
  const allClosed =
    s.finishedSubpaths.every((sp) => sp.closed) &&
    (open === null || open.closed);
  const path = buildPath(s.finishedSubpaths, open);
  const select = settings.autoSelect ? commitSelectionFrom(deps.operands) : undefined;
  deps.insert?.commit(boundsOfPath(path), { kind: 'path', path, closed: allClosed, style: penOptionValues(settings.toolOptions, deps).style }, undefined, select);
  resetScratch(s);
}
