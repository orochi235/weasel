/**
 * The clicks that author a sequence: a lifeline added where the click falls
 * between two, or a new sequence started on empty canvas; a note dropped on
 * the row nearest the click. Each hands one edit of the root's data to the
 * commit, by default one undo entry in the scene.
 */
import type { Action, ActionDeps, Scene, Vec2 } from '@weasel-js/core';
import { sequenceLayout } from './layout';
import { addParticipant, newParticipant, type SeqParticipantKind } from './author';
import { insertMark, insertNote } from './authorSteps';
import { columnIndexAt, columnNear, sequenceAt, slotNear, type SequenceHit } from './authorPlace';
import { sequenceCommitOf, startSequence, type SequenceEditOptions } from './commit';

import type { SeqMark, SequenceData } from './types';

/** The action a Participant tool's click runs. */
export const ADD_PARTICIPANT_ACTION_ID = 'diagram.sequence.addParticipant';
/** The action a Note tool's click runs. */
export const ADD_NOTE_ACTION_ID = 'diagram.sequence.addNote';
/** The action a Mark tool's click runs. */
export const ADD_MARK_ACTION_ID = 'diagram.sequence.addMark';

/** Options for the sequence authoring actions. */
export interface SequenceAuthorOptions extends SequenceEditOptions {
  /**
   * Starts a new sequence holding `data` with its top-left corner at `at`, for
   * a Participant click on empty canvas. Default {@link startSequence} against
   * the scene when `commit` is the default; with a `commit` of its own and no
   * `start`, a click off every sequence does nothing.
   */
  start?: ((at: Vec2, data: SequenceData, deps: ActionDeps) => void) | null;
}

type AnyScene = Scene<unknown, string, unknown>;

/** Within this many world units of a lifeline, a note click lands over it rather than beside it. */
export const NOTE_OVER_REACH = 20;

/** The world point an immediate action's click params carry. */
const worldOf = (params: Record<string, unknown> | undefined): Vec2 | null => {
  const w = params?.world as Vec2 | undefined;
  return w !== undefined && typeof w.x === 'number' && typeof w.y === 'number' ? w : null;
};

/** The scene and the root a click landed on, read from an immediate action's deps and params. */
function clickOf(deps: ActionDeps, params: Record<string, unknown> | undefined): { scene: AnyScene; at: Vec2; hit: SequenceHit | null } | null {
  const scene = deps.scene as AnyScene | undefined;
  const at = worldOf(params);
  return scene === undefined || at === null ? null : { scene, at, hit: sequenceAt(scene, at) };
}

/** A sequence holding only `p`, placed so its lifeline stands at `at`'s x and its head's top at `at`'s y. */
function firstAt(at: Vec2, p: SequenceData['participants'][number], opts: SequenceEditOptions): { at: Vec2; data: SequenceData } {
  const data: SequenceData = { participants: [p], steps: [] };
  const layout = sequenceLayout(data, opts.measure ? { measure: opts.measure } : {});
  const head = layout.heads[0]!;
  return { at: { x: at.x - layout.columns[0]!.x, y: at.y - head.box.y }, data };
}

/** The Participant tool's action: a click on a sequence adds a lifeline there, of `params.kind`; one off every sequence starts one. */
export function createAddParticipantAction(opts: SequenceAuthorOptions = {}): Action {
  const commit = sequenceCommitOf(opts);
  const start = opts.start !== undefined ? opts.start
    : opts.commit !== undefined ? null
    : (at: Vec2, data: SequenceData, deps: ActionDeps) => {
      if (deps.scene !== undefined) startSequence(deps.scene as AnyScene, at, data, 'Add sequence', opts);
    };
  return {
    id: ADD_PARTICIPANT_ACTION_ID, label: 'Add participant', group: 'diagram', requires: ['scene'],
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const click = clickOf(deps, params);
        if (click === null) return 'pass';
        const kind: SeqParticipantKind = params?.kind === 'actor' ? 'actor' : 'participant';
        const { hit } = click;
        if (hit === null) {
          if (start === null) return 'pass';
          const first = firstAt(click.at, newParticipant({ participants: [], steps: [] }, kind), opts);
          start(first.at, first.data, deps);
          return undefined;
        }
        const data = addParticipant(hit.data, newParticipant(hit.data, kind), columnIndexAt(hit.root, hit.local.x));
        commit({ id: hit.root.id, data, label: 'Add participant' }, { deps });
        return undefined;
      },
    },
    enabled: () => true as const,
  };
}

/**
 * The note a click at local `x`, `y` on `hit` drops: on the nearest row, over
 * the nearest lifeline, or beside it on the click's side when the click is
 * farther than {@link NOTE_OVER_REACH} from it.
 */
export function noteAt(hit: SequenceHit, x: number, y: number): SequenceData {
  const column = columnNear(hit.root, x);
  const slot = slotNear(hit.root, y);
  if (column === null || slot === null) return hit.data;
  const dx = x - column.x;
  const side = Math.abs(dx) <= NOTE_OVER_REACH ? undefined : dx > 0 ? 'right' as const : 'left' as const;
  return insertNote(hit.data, { over: [column.id], at: slot.place, ...(side ? { side } : {}) });
}

/** The Note tool's click: a note on the row nearest the click, over or beside the nearest lifeline. */
export function createAddNoteAction(opts: SequenceEditOptions = {}): Action {
  const commit = sequenceCommitOf(opts);
  return {
    id: ADD_NOTE_ACTION_ID, label: 'Add note', group: 'diagram', requires: ['scene'],
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const hit = clickOf(deps, params)?.hit ?? null;
        if (hit === null) return 'pass';
        const data = noteAt(hit, hit.local.x, hit.local.y);
        if (data !== hit.data) commit({ id: hit.root.id, data, label: 'Add note' }, { deps });
        return undefined;
      },
    },
    enabled: () => true as const,
  };
}

const MARKS: ReadonlySet<string> = new Set<SeqMark['kind']>(['activate', 'deactivate', 'create', 'destroy']);

/**
 * The Mark tool's click: a mark of `params.mark` (default `activate`) on the
 * lifeline nearest the click, at the row slot nearest it: an activation
 * starting or ending, the head created there, or the lifeline ended.
 */
export function createAddMarkAction(opts: SequenceEditOptions = {}): Action {
  const commit = sequenceCommitOf(opts);
  return {
    id: ADD_MARK_ACTION_ID, label: 'Add lifeline mark', group: 'diagram', requires: ['scene'],
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const hit = clickOf(deps, params)?.hit ?? null;
        const column = hit === null ? null : columnNear(hit.root, hit.local.x);
        const slot = hit === null ? null : slotNear(hit.root, hit.local.y);
        if (hit === null || column === null || slot === null) return 'pass';
        const kind = MARKS.has(params?.mark as string) ? params!.mark as SeqMark['kind'] : 'activate';
        const data = insertMark(hit.data, { kind, participant: column.id }, slot.place);
        if (data !== hit.data) commit({ id: hit.root.id, data, label: 'Add lifeline mark' }, { deps });
        return undefined;
      },
    },
    enabled: () => true as const,
  };
}
