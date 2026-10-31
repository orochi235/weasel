/**
 * Picking a sequence's parts and deleting them. A click on a head, a message,
 * a note, a fragment's tab, or a box's label strip selects the scene node that
 * draws it; Delete on a selection holding such nodes removes what they draw
 * from their root's data, one edit per root, and the rest of the selection as
 * core's delete would.
 */
import {
  commitDeleteToScene, createDeleteAction, type Action, type ActionDeps, type NodeId, type Scene, type SelectionApi,
} from '@weasel-js/core';
import { removeBox, removeParticipant } from './author';
import { removeMarks, removeStep } from './authorSteps';
import { sequenceCommitOf, type SequenceEditOptions } from './commit';
import { sequenceScratchOf, type SequenceScratch } from './layer';
import { sequencePartOf, sequenceRootOf } from './trait';
import type { SeqMarkRef, SequenceData } from './types';

/** The action a click on a sequence part runs. */
export const SELECT_SEQUENCE_PART_ACTION_ID = 'diagram.sequence.select';

type AnyScene = Scene<unknown, string, unknown>;

/** The id of the node that draws what `s` names, among its root's parts: a head, a message, a note, a fragment's box, a box. */
export function sequencePartNodeOf(scene: AnyScene, s: Pick<SequenceScratch, 'root' | 'part' | 'id'>): string | null {
  if (s.part === 'mark') return scene.get(`${s.root}/${s.id}` as never) === undefined ? null : `${s.root}/${s.id}`;
  const names = s.part === 'head' ? [`head:${s.id}`]
    : s.part === 'box' ? [`box:${s.id}`]
    : s.part === 'end' ? [`msg:${s.id}`]
    : [`msg:${s.id}`, `note:${s.id}`, `frag:${s.id}`];
  return names.map((n) => `${s.root}/${n}`).find((id) => scene.get(id as never) !== undefined) ?? null;
}

/** The sequence part's click: selects the node drawing it, or with Shift adds it to the selection or takes it out. */
export const selectSequencePartAction: Action = {
  id: SELECT_SEQUENCE_PART_ACTION_ID, label: 'Select sequence part', group: 'diagram', requires: ['scene', 'selection'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const scene = deps.scene as AnyScene | undefined;
      const selection = deps.selection as SelectionApi | undefined;
      const scratch = sequenceScratchOf(params?.affordance as { payload?: unknown } | undefined);
      const id = scene === undefined || scratch === null ? null : sequencePartNodeOf(scene, scratch);
      if (id === null || selection === undefined) return;
      const held = selection.get() as readonly string[];
      const shift = (params?.mods as { shift?: boolean } | undefined)?.shift === true;
      selection.set((!shift ? [id] : held.includes(id) ? held.filter((h) => h !== id) : [...held, id]) as NodeId[]);
    },
  },
  enabled: () => true as const,
};

/** What a selected part removes from its root's data: a head or lifeline its participant, a box itself, a message's, note's, or fragment's part its step. */
function removing(data: SequenceData, part: { part: string; id: string }): SequenceData {
  if (part.part === 'head' || part.part === 'lifeline') return removeParticipant(data, part.id);
  if (part.part === 'box') return removeBox(data, part.id);
  if (part.part === 'message' || part.part === 'note' || part.part === 'fragment' || part.part === 'divider') return removeStep(data, part.id);
  return data;
}

/**
 * `ids` split into the sequence edits deleting them make, one per root, and
 * the ids that are no sequence's part. An activation bar or a destruction's
 * cross removes the marks and message flags that draw it. A part that draws
 * nothing an edit can remove (a number, a section label) is dropped.
 */
export function sequenceDeletes(scene: AnyScene, ids: readonly string[]): { edits: { id: string; data: SequenceData }[]; rest: string[] } {
  // Marks go by place, so they come out of each root's data as it was, before anything else shifts them.
  const byRoot = new Map<string, { was: SequenceData; marks: SeqMarkRef[]; parts: { part: string; id: string }[] }>();
  const rest: string[] = [];
  for (const id of ids) {
    const node = scene.get(id as never);
    const part = node === undefined ? null : sequencePartOf(node);
    if (part === null) {
      rest.push(id);
      continue;
    }
    const root = scene.get(part.root as never);
    const held = root === undefined ? null : sequenceRootOf(root);
    if (held === null) continue;
    const at = byRoot.get(part.root) ?? { was: held.sequence, marks: [], parts: [] };
    byRoot.set(part.root, at);
    if (part.marks !== undefined) at.marks.push(...part.marks);
    else if (part.id !== undefined) at.parts.push({ part: part.part, id: part.id });
  }
  const edits = [...byRoot].flatMap(([id, { was, marks, parts }]) => {
    const data = parts.reduce(removing, removeMarks(was, marks));
    return data === was ? [] : [{ id, data }];
  });
  return { edits, rest };
}

/** Options for {@link createSequenceDeleteAction}. */
export interface SequenceDeleteOptions extends SequenceEditOptions {
  /** Deletes the selected ids that are no sequence's part. Default core's `commitDeleteToScene`. */
  others?: (ids: readonly NodeId[], deps: ActionDeps) => void;
}

/**
 * Core's `delete`, for a canvas holding sequences: the selected sequence parts
 * are removed from their roots' data (a head takes its participant and what
 * names it), the rest go to `others`, and the selection is emptied.
 */
export function createSequenceDeleteAction(opts: SequenceDeleteOptions = {}): Action {
  const commit = sequenceCommitOf(opts);
  const others = opts.others ?? commitDeleteToScene;
  return createDeleteAction({
    commit: (ids, deps) => {
      const scene = deps.scene as AnyScene | undefined;
      if (scene === undefined) return;
      const { edits, rest } = sequenceDeletes(scene, ids);
      for (const edit of edits) commit({ ...edit, label: 'Delete' }, { deps });
      if (rest.length > 0) others(rest as NodeId[], deps);
      else deps.selection?.set([]);
    },
  });
}
