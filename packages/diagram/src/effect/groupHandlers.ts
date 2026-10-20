/** What one drag under `nodeGraph` reports, stage moves and group box edits
 *  alike, turned into one edit of the doc. */
import type { NodeMove } from '../DiagramView';
import type { ContainerEdit } from '../regionSync';
import { moveStages } from './edit';
import type { EditorScene } from './editorMapping';
import { groupContents, moveGroup, moveToGroup, setGroupBox } from './groupEdit';
import type { EffectBox, EffectDoc } from './types';

const parentGroup = (doc: EffectDoc, id: string) => doc.pipeline.groups?.find((g) => g.members.includes(id))?.id;

type BoxEdit = Extract<ContainerEdit, { kind: 'box' }>;

/** What a drag reported, gathered until it is done reporting. */
export interface DragReports {
  moves: NodeMove[];
  boxes: BoxEdit[];
}

/**
 * One drag's reports as one edit of `doc`, or `null` when none of them is a
 * stage's or a group's. A group whose box kept its size moved, carrying what
 * is inside it, so the moves and box edits reported for those are dropped; a
 * box that changed size was resized. A `parent` moves a stage or group into
 * that group, or out to the top level. `boxOf` is where each group was drawn.
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
    if (parent === null || built.groupOf(parent) !== undefined) next = moveToGroup(next, [id], parent);
  };
  const depth = (id: string) => {
    let n = 0;
    for (let at = parentGroup(doc, id); at !== undefined; at = parentGroup(doc, at)) n++;
    return n;
  };
  for (const edit of [...reports.boxes].sort((a, b) => depth(a.id) - depth(b.id))) {
    const group = built.groupOf(edit.id);
    const was = boxOf(edit.id);
    if (group === undefined || was === undefined || carried.has(group)) continue;
    touched = true;
    reparent(group, edit.parent);
    if (edit.box.width === was.width && edit.box.height === was.height) {
      next = moveGroup(next, group, { x: edit.box.x - was.x, y: edit.box.y - was.y });
      const inside = groupContents(doc, group);
      for (const id of [...inside.stages, ...inside.groups]) carried.add(id);
    } else {
      next = setGroupBox(next, group, edit.box);
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
