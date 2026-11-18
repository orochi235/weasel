/** What one drag under `nodeGraph` reports, stage moves and cluster box edits
 *  alike, turned into one edit of the doc. */
import type { NodeMove } from '../DiagramView';
import type { ContainerEdit } from '../regionSync';
import { moveStages } from './edit';
import type { EditorScene } from './editorMapping';
import { clusterContents, moveCluster, moveToCluster, setClusterBox } from './clusterEdit';
import type { EffectBox, EffectDoc } from './types';

const parentCluster = (doc: EffectDoc, id: string) => doc.pipeline.clusters?.find((g) => g.members.includes(id))?.id;

type BoxEdit = Extract<ContainerEdit, { kind: 'box' }>;

/** What a drag reported, gathered until it is done reporting. */
export interface DragReports {
  moves: NodeMove[];
  boxes: BoxEdit[];
}

/**
 * One drag's reports as one edit of `doc`, or `null` when none of them is a
 * stage's or a cluster's. A cluster whose box kept its size moved, carrying what
 * is inside it, so the moves and box edits reported for those are dropped; a
 * box that changed size was resized. A `parent` moves a stage or cluster into
 * that cluster, or out to the top level. `boxOf` is where each cluster was drawn.
 */
export function dragEdit(
  doc: EffectDoc, built: EditorScene, reports: DragReports, boxOf: (id: string) => EffectBox | undefined,
): { doc: EffectDoc; label: string } | null {
  let next = doc;
  let resized = false;
  let touched = false;
  const carried = new Set<string>();
  const reparent = (id: string, parent: string | null | undefined) => {
    if (parent === undefined) return;
    if (parent === null || built.clusterOf(parent) !== undefined) next = moveToCluster(next, [id], parent);
  };
  const depth = (id: string) => {
    let n = 0;
    for (let at = parentCluster(doc, id); at !== undefined; at = parentCluster(doc, at)) n++;
    return n;
  };
  for (const edit of [...reports.boxes].sort((a, b) => depth(a.id) - depth(b.id))) {
    const cluster = built.clusterOf(edit.id);
    const was = boxOf(edit.id);
    if (cluster === undefined || was === undefined || carried.has(cluster)) continue;
    touched = true;
    reparent(cluster, edit.parent);
    if (edit.box.width === was.width && edit.box.height === was.height) {
      next = moveCluster(next, cluster, { x: edit.box.x - was.x, y: edit.box.y - was.y });
      const inside = clusterContents(doc, cluster);
      for (const id of [...inside.stages, ...inside.clusters]) carried.add(id);
    } else {
      next = setClusterBox(next, cluster, edit.box);
      resized = true;
    }
  }
  const moves = reports.moves.filter((m) => built.stageOf(m.id) !== undefined && !carried.has(m.id));
  for (const m of moves) reparent(m.id, m.parent);
  if (moves.length > 0) {
    next = moveStages(next, moves.map(({ id, x, y }) => ({ id, x, y })));
    touched = true;
  }
  return touched ? { doc: next, label: resized && moves.length === 0 ? 'Resize group' : 'Move' } : null;
}
