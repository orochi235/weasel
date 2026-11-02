/**
 * The drags that author a sequence: a message from one lifeline to another
 * (or back to itself), a note spanning the lifelines dragged across, and a
 * fragment wrapping the rows dragged across. Each previews what it would add
 * as gesture chrome and, on release, hands one edit of the root's data to the
 * commit, by default one undo entry in the scene.
 */
import type { Action, InvocationCtx, OngoingHandle, OngoingOverlay, Scene, Vec2 } from '@weasel-js/core';
import { SEQ_ARROWS, insertMessage, insertNote, wrapSteps, type SeqArrow, type SeqArrowName } from './authorSteps';
import { columnNear, sequenceAt, sequenceHitOf, slotNear, type SequenceHit } from './authorPlace';
import { sameList } from './edit';
import { noteAt } from './authorActions';
import { sequenceCommitOf, type SequenceEditOptions } from './commit';
import { SEQ } from './metrics';
import type { SeqFragment, SequenceData } from './types';

/** The action a Message tool's drag runs. */
export const DRAW_MESSAGE_ACTION_ID = 'diagram.sequence.drawMessage';
/** The action a Note tool's drag runs. */
export const DRAW_NOTE_ACTION_ID = 'diagram.sequence.drawNote';
/** The action a Fragment tool's drag runs. */
export const WRAP_FRAGMENT_ACTION_ID = 'diagram.sequence.wrapFragment';

type AnyScene = Scene<unknown, string, unknown>;

/** What a drag proposes with the pointer at a point: the edit, and the chrome previewing it. */
interface Proposal { data: SequenceData; label: string; overlay: OngoingOverlay[] }

/** Builds a drag's proposal from its press, the pointer now, and its binding's params. */
type Plan = (press: SequenceHit, now: SequenceHit, params: Record<string, unknown>) => Proposal | null;

/** A binding's params, its thunk called. */
function paramsOf(opts: { params?: unknown } | undefined): Record<string, unknown> {
  const p = opts?.params;
  return ((typeof p === 'function' ? (p as () => unknown)() : p) ?? {}) as Record<string, unknown>;
}

/** An ongoing action over the root a press lands on, proposing `plan` as the pointer moves and committing it on release. */
function authorDrag(id: string, label: string, opts: SequenceEditOptions, plan: Plan): Action {
  const commit = sequenceCommitOf(opts);
  return {
    id, label, group: 'diagram', requires: ['scene'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx, binding): OngoingHandle {
        const scene = ctx.deps.scene as AnyScene | undefined;
        const start = ctx.drag?.start ?? { x: ctx.world.x, y: ctx.world.y };
        const press = scene === undefined ? null : sequenceAt(scene, start);
        if (scene === undefined || press === null) return {};
        let proposal: Proposal | null = null;
        const propose = (at: Vec2) => {
          const now = sequenceHitOf(scene, press.root.id, at);
          proposal = now === null ? null : plan(press, now, paramsOf(binding));
        };
        return {
          kind: id,
          onMove(move) { propose({ x: move.world.x, y: move.world.y }); },
          overlay: () => proposal?.overlay ?? null,
          onEnd(end, reason) {
            if (reason === 'commit') propose({ x: end.world.x, y: end.world.y });
            const done = proposal;
            proposal = null;
            if (reason !== 'commit' || done === null || done.data === press.data) return;
            commit({ id: press.root.id, data: done.data, label: done.label }, { deps: { ...end.deps, scene: scene as never } });
          },
        };
      },
    },
    enabled: () => true as const,
  };
}

/** World point `x`, `y` of `hit`'s frame. */
const world = (hit: SequenceHit, x: number, y: number): Vec2 => ({ x: hit.root.origin.x + x, y: hit.root.origin.y + y });

/** `params.arrow` as an arrow: a name in `SEQ_ARROWS`, an arrow of its own, else a call. */
const arrowOf = (params: Record<string, unknown>): SeqArrow =>
  typeof params.arrow === 'object' && params.arrow !== null ? params.arrow as SeqArrow
  : SEQ_ARROWS[(params.arrow as SeqArrowName | undefined) ?? 'sync'] ?? SEQ_ARROWS.sync;

/**
 * The Message tool's drag: from the lifeline nearest the press to the one
 * nearest the release, inserted at the row slot nearest the press, drawn with
 * `params.arrow`. Released back on its own lifeline, it is a self-message.
 */
export function createDrawMessageAction(opts: SequenceEditOptions = {}): Action {
  return authorDrag(DRAW_MESSAGE_ACTION_ID, 'Draw message', opts, (press, now, params) => {
    const from = columnNear(press.root, press.local.x);
    const to = columnNear(now.root, now.local.x);
    const slot = slotNear(press.root, press.local.y);
    if (from === null || to === null || slot === null) return null;
    const data = insertMessage(press.data, { from: from.id, to: to.id, at: slot.place, arrow: arrowOf(params) });
    const y = slot.y;
    const points = from.id === to.id
      ? [world(press, from.x, y), world(press, from.x + SEQ.loopWidth, y), world(press, from.x + SEQ.loopWidth, y + SEQ.loopHeight), world(press, from.x, y + SEQ.loopHeight)]
      : [world(press, from.x, y), world(press, now.local.x, y)];
    return { data, label: 'Add message', overlay: [{ kind: 'polyline', points, role: 'connector' }] };
  });
}

/** A box's outline as a closed run of world points. */
const outline = (hit: SequenceHit, x0: number, y0: number, x1: number, y1: number): Vec2[] =>
  [world(hit, x0, y0), world(hit, x1, y0), world(hit, x1, y1), world(hit, x0, y1), world(hit, x0, y0)];

/**
 * The Note tool's drag: a note over every lifeline from the one nearest the
 * press to the one nearest the release, on the row slot nearest the press.
 * Released on the lifeline it started on, it lands as a click there would.
 */
export function createDrawNoteAction(opts: SequenceEditOptions = {}): Action {
  return authorDrag(DRAW_NOTE_ACTION_ID, 'Draw note', opts, (press, now) => {
    const from = columnNear(press.root, press.local.x);
    const to = columnNear(now.root, now.local.x);
    const slot = slotNear(press.root, press.local.y);
    if (from === null || to === null || slot === null) return null;
    const data = from.id === to.id
      ? noteAt(press, now.local.x, press.local.y)
      : insertNote(press.data, { over: from.index < to.index ? [from.id, to.id] : [to.id, from.id], at: slot.place });
    const [x0, x1] = [Math.min(from.x, to.x) - SEQ.noteOverhang, Math.max(from.x, to.x) + SEQ.noteOverhang];
    return { data, label: 'Add note', overlay: [{ kind: 'polyline', points: outline(press, x0, slot.y, x1, slot.y + SEQ.rowGap * 2), role: 'insert' }] };
  });
}

const FRAGMENT_TYPES: ReadonlySet<string> = new Set<SeqFragment['type']>(['loop', 'alt', 'opt', 'par', 'critical', 'break', 'region']);

/**
 * The Fragment tool's drag: a fragment of `params.type` (default `loop`)
 * wrapping the rows between the slot nearest the press and the slot in the
 * same list nearest the pointer. A still release wraps nothing, leaving an
 * empty fragment to drag rows into.
 */
export function createWrapFragmentAction(opts: SequenceEditOptions = {}): Action {
  return authorDrag(WRAP_FRAGMENT_ACTION_ID, 'Wrap in fragment', opts, (press, now, params) => {
    const first = slotNear(press.root, press.local.y);
    if (first === null) return null;
    const last = slotNear(press.root, now.local.y, (place) => sameList(place.parent, first.place.parent)) ?? first;
    const type = FRAGMENT_TYPES.has(params.type as string) ? params.type as SeqFragment['type'] : 'loop';
    const data = wrapSteps(press.data, first.place.parent, first.place.index, last.place.index, { type });
    const xs = press.root.geometry.columns.map((c) => c.x);
    const [x0, x1] = [Math.min(...xs, press.local.x) - SEQ.fragmentPad, Math.max(...xs, press.local.x) + SEQ.fragmentPad];
    const [y0, y1] = [Math.min(first.y, last.y), Math.max(first.y, last.y, Math.min(first.y, last.y) + SEQ.rowGap)];
    return { data, label: 'Add fragment', overlay: [{ kind: 'polyline', points: outline(press, x0, y0, x1, y1), role: 'target' }] };
  });
}
