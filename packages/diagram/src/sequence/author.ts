/**
 * Authoring a sequence's columns: participants added and removed, boxes drawn
 * around them, messages numbered. Pure functions from one `SequenceData` to
 * the next; a no-op returns the data it was given.
 */
import type { Outline } from '../outline';
import { flatSteps } from './columns';
import { hasId, pruneSteps } from './edit';
import type { SeqBox, SeqParticipant, SequenceData } from './types';

/** Every id `data` uses: its participants', its steps', its boxes'. */
function idsOf(data: SequenceData): Set<string> {
  const ids = new Set(data.participants.map((p) => p.id));
  for (const s of flatSteps(data.steps)) if (hasId(s)) ids.add(s.id);
  for (const b of data.boxes ?? []) ids.add(b.id);
  return ids;
}

/** Whether a participant, step, or box in `data` already has `id`. */
export const seqIdTaken = (data: SequenceData, id: string): boolean => idsOf(data).has(id);

/** An id nothing in `data` uses yet: `prefix` and the lowest free number from 1. */
export function freshSeqId(data: SequenceData, prefix: string): string {
  const ids = idsOf(data);
  let n = 1;
  while (ids.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** What a new participant is drawn as: a plain box, or the UML stick figure. */
export type SeqParticipantKind = 'participant' | 'actor';

/** A participant `data` can take: a fresh id, and a label naming its kind and number ("Actor 2"). */
export function newParticipant(data: SequenceData, kind: SeqParticipantKind = 'participant'): SeqParticipant {
  const id = freshSeqId(data, kind === 'actor' ? 'A' : 'P');
  const label = `${kind === 'actor' ? 'Actor' : 'Participant'} ${id.slice(1)}`;
  return { id, label, ...(kind === 'actor' ? { outline: 'actor' as const } : {}) };
}

/** `p` added at `index` among the participants (default last). Nothing changes when its id is taken. */
export function addParticipant(data: SequenceData, p: SeqParticipant, index = data.participants.length): SequenceData {
  if (seqIdTaken(data, p.id)) return data;
  const at = Math.max(0, Math.min(index, data.participants.length));
  return { ...data, participants: [...data.participants.slice(0, at), p, ...data.participants.slice(at)] };
}

/**
 * Participant `id` removed, with what names it: every message to or from it,
 * every activation, creation, or destruction of it, and it from every note
 * and box, a note or box left naming no one going too. Fragments stay, even
 * emptied, since they hold no participant of their own.
 */
export function removeParticipant(data: SequenceData, id: string): SequenceData {
  if (!data.participants.some((p) => p.id === id)) return data;
  const steps = pruneSteps(data.steps, (s) => {
    if (s.kind === 'message') return s.from === id || s.to === id ? null : s;
    if (s.kind === 'note') {
      if (!s.over.includes(id)) return s;
      const over = s.over.filter((q) => q !== id);
      return over.length === 0 ? null : { ...s, over };
    }
    if (s.kind === 'fragment') return s;
    return s.participant === id ? null : s;
  });
  const boxes = data.boxes?.flatMap((b) => {
    if (!b.members.includes(id)) return [b];
    const members = b.members.filter((m) => m !== id);
    return members.length === 0 ? [] : [{ ...b, members }];
  });
  const { boxes: _boxes, ...rest } = data;
  return {
    ...rest, participants: data.participants.filter((p) => p.id !== id), steps,
    ...(boxes !== undefined && boxes.length > 0 ? { boxes } : {}),
  };
}

/** Participant `id` drawn as `outline`; `undefined` or `'rect'` is the plain box. */
export function setParticipantOutline(data: SequenceData, id: string, outline: Outline | undefined): SequenceData {
  const at = data.participants.findIndex((p) => p.id === id);
  const p = data.participants[at];
  const next = outline === 'rect' ? undefined : outline;
  if (p === undefined || p.outline === next) return data;
  const { outline: _outline, ...rest } = p;
  const q = next === undefined ? rest : { ...rest, outline: next };
  return { ...data, participants: data.participants.map((r, i) => (i === at ? q : r)) };
}

/**
 * `box` drawn around its members: ids naming no participant are dropped, each
 * member leaves any box it was in (one left empty goes), and the members are
 * gathered side by side where the first of them stands, since a box spans
 * every column between its ends. Nothing changes for a box naming no one, or
 * whose id is taken.
 */
export function addBox(data: SequenceData, box: SeqBox): SequenceData {
  const members = data.participants.filter((p) => box.members.includes(p.id));
  if (members.length === 0 || seqIdTaken(data, box.id)) return data;
  const taken = new Set(members.map((p) => p.id));
  const first = data.participants.findIndex((p) => taken.has(p.id));
  const before = data.participants.slice(0, first).filter((p) => !taken.has(p.id));
  const after = data.participants.slice(first).filter((p) => !taken.has(p.id));
  const others = (data.boxes ?? []).flatMap((b) => {
    const left = b.members.filter((m) => !taken.has(m));
    return left.length === 0 ? [] : [left.length === b.members.length ? b : { ...b, members: left }];
  });
  return {
    ...data, participants: [...before, ...members, ...after],
    boxes: [...others, { ...box, members: members.map((p) => p.id) }],
  };
}

/** Box `id` removed; its members stay. */
export function removeBox(data: SequenceData, id: string): SequenceData {
  if (!data.boxes?.some((b) => b.id === id)) return data;
  const boxes = data.boxes.filter((b) => b.id !== id);
  const { boxes: _boxes, ...rest } = data;
  return boxes.length === 0 ? rest : { ...rest, boxes };
}

/** Messages numbered from `from`, or not numbered at all for `undefined`. */
export function setAutonumber(data: SequenceData, from: number | undefined): SequenceData {
  if (data.autonumber === from) return data;
  const { autonumber: _n, ...rest } = data;
  return from === undefined ? rest : { ...rest, autonumber: from };
}
