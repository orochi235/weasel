/**
 * Authoring a sequence's rows: messages, notes, and marks inserted, runs of
 * steps wrapped in fragments, sections added, and any step removed. Pure
 * functions from one `SequenceData` to the next; a no-op returns the data it
 * was given.
 */
import { freshSeqId, seqIdTaken } from './author';
import { findStep, hasId, mapSteps, placeOf, pruneSteps, stepListOf, withList } from './edit';
import type { SeqFragment, SeqMark, SeqMarkRef, SeqMessage, SeqNote, SeqStep, SequenceData, StepPlace } from './types';

/** How a message is drawn: its line, its head, and whether it has a head at both ends or is sent without waiting. */
export type SeqArrow = Pick<SeqMessage, 'line' | 'head'> & Pick<Partial<SeqMessage>, 'both' | 'async'>;

/** The arrows a message is commonly drawn with, by name; each one Mermaid writes. */
export const SEQ_ARROWS = {
  /** A call: a solid line, a filled head. */
  sync: { line: 'solid', head: 'arrow' },
  /** An answer: a dashed line, a filled head. */
  reply: { line: 'dashed', head: 'arrow' },
  /** Sent without waiting: a solid line, an open head. */
  async: { line: 'solid', head: 'open', async: true },
  /** Lost or refused: a solid line ending in a cross. */
  lost: { line: 'solid', head: 'cross' },
  /** A plain solid line. */
  line: { line: 'solid', head: 'none' },
  /** A plain dashed line. */
  dashed: { line: 'dashed', head: 'none' },
  /** Both ways: a solid line, filled heads at both ends. */
  both: { line: 'solid', head: 'arrow', both: true },
} as const satisfies Record<string, SeqArrow>;

/** A name in {@link SEQ_ARROWS}. */
export type SeqArrowName = keyof typeof SEQ_ARROWS;

/** The fragment types that hold more than one section: an alt's branches, a par's threads, a critical's options. */
export const SEQ_MULTI_SECTION: ReadonlySet<SeqFragment['type']> = new Set(['alt', 'par', 'critical']);

/** `step` inserted at `at`, whose index is clamped to its list. Nothing changes where `at` names no list, or the step's id is taken. */
export function insertStep(data: SequenceData, step: SeqStep, at: StepPlace): SequenceData {
  const list = stepListOf(data.steps, at.parent);
  if (list === null || (hasId(step) && seqIdTaken(data, step.id))) return data;
  const index = Math.max(0, Math.min(at.index, list.length));
  return { ...data, steps: withList(data.steps, at.parent, (l) => [...l.slice(0, index), step, ...l.slice(index)]) };
}

const known = (data: SequenceData, ...ids: string[]): boolean => ids.every((id) => data.participants.some((p) => p.id === id));

/** What {@link insertMessage} takes. */
export interface NewSeqMessage {
  from: string;
  to: string;
  at: StepPlace;
  /** A name in {@link SEQ_ARROWS}, or an arrow of its own. Default `'sync'`. */
  arrow?: SeqArrowName | SeqArrow;
  text?: string;
  /** Default a fresh `m` id. */
  id?: string;
}

/** A message from `from` to `to` (the same for a self-message) inserted at `at`. Nothing changes for an unknown participant. */
export function insertMessage(data: SequenceData, m: NewSeqMessage): SequenceData {
  if (!known(data, m.from, m.to)) return data;
  const arrow = typeof m.arrow === 'object' ? m.arrow : SEQ_ARROWS[m.arrow ?? 'sync'];
  const step: SeqMessage = {
    kind: 'message', id: m.id ?? freshSeqId(data, 'm'), from: m.from, to: m.to, ...arrow, ...(m.text ? { text: m.text } : {}),
  };
  return insertStep(data, step, m.at);
}

/** What {@link insertNote} takes. */
export interface NewSeqNote {
  /** Participant ids: one, or the first and last of a span. */
  over: readonly string[];
  /** Beside its participant rather than over it. */
  side?: 'left' | 'right';
  at: StepPlace;
  /** Default `'Note'`. */
  text?: string;
  /** Default a fresh `n` id. */
  id?: string;
}

/** A note over (or beside) participants inserted at `at`. Nothing changes for an unknown participant or none at all. */
export function insertNote(data: SequenceData, n: NewSeqNote): SequenceData {
  if (n.over.length === 0 || !known(data, ...n.over)) return data;
  const step: SeqNote = {
    kind: 'note', id: n.id ?? freshSeqId(data, 'n'), over: n.side === undefined ? [...n.over] : [n.over[0]!],
    ...(n.side ? { side: n.side } : {}), text: n.text ?? 'Note',
  };
  return insertStep(data, step, n.at);
}

/**
 * A lifeline mark inserted at `at`: an activation starting or ending, its head
 * created there (it is then not drawn at the top), or its lifeline ended.
 * Nothing changes for an unknown participant, or a second `create` of one.
 */
export function insertMark(data: SequenceData, mark: SeqMark, at: StepPlace): SequenceData {
  if (!known(data, mark.participant)) return data;
  if (mark.kind === 'create' && hasMark(data.steps, 'create', mark.participant)) return data;
  return insertStep(data, { kind: mark.kind, participant: mark.participant }, at);
}

function hasMark(steps: readonly SeqStep[], kind: SeqMark['kind'], participant: string): boolean {
  return steps.some((s) => (s.kind === kind && (s as SeqMark).participant === participant)
    || (s.kind === 'fragment' && s.sections.some((sec) => hasMark(sec.steps, kind, participant))));
}

/** Step `id` removed, with all a fragment holds. */
export function removeStep(data: SequenceData, id: string): SequenceData {
  if (findStep(data.steps, id) === null) return data;
  return { ...data, steps: pruneSteps(data.steps, (s) => (hasId(s) && s.id === id ? null : s)) };
}

/** The step at `at` removed: how a mark, which has no id, is taken out. */
export function removeStepAt(data: SequenceData, at: StepPlace): SequenceData {
  const list = stepListOf(data.steps, at.parent);
  if (list === null || at.index < 0 || at.index >= list.length) return data;
  return { ...data, steps: withList(data.steps, at.parent, (l) => l.filter((_, i) => i !== at.index)) };
}

/**
 * What `refs` name removed: each mark step at its place, and each message
 * flag cleared. The places are read against `data` as given, so removing one
 * does not shift the next. A place holding anything but a mark is left alone.
 */
export function removeMarks(data: SequenceData, refs: readonly SeqMarkRef[]): SequenceData {
  const key = (p: StepPlace['parent']) => (p === null ? '' : `${p.fragment}/${p.section}`);
  const places = refs.flatMap((r) => ('place' in r ? [r.place] : []))
    .filter((p) => {
      const s = stepListOf(data.steps, p.parent)?.[p.index];
      return s !== undefined && !hasId(s);
    })
    .sort((a, b) => (key(a.parent) === key(b.parent) ? b.index - a.index : key(a.parent) < key(b.parent) ? -1 : 1));
  let next = places.reduce((d, p) => removeStepAt(d, p), data);
  for (const r of refs) if ('message' in r) next = setMessageActivation(next, r.message, { [r.flag]: undefined });
  return next;
}

/** Every `kind` mark naming `participant` removed, at any depth: a created head drawn at the top again, say. */
export function removeMarksOf(data: SequenceData, kind: SeqMark['kind'], participant: string): SequenceData {
  const steps = pruneSteps(data.steps, (s) => (s.kind === kind && (s as SeqMark).participant === participant ? null : s));
  return steps === data.steps ? data : { ...data, steps };
}

/** What {@link wrapSteps} takes. */
export interface NewSeqFragment {
  type: SeqFragment['type'];
  /** The first section's guard or title. */
  label?: string;
  /** Default a fresh `f` id. */
  id?: string;
}

/**
 * The steps of the list at `parent` from `start` up to (not including) `end`
 * wrapped in a new fragment standing where they stood. An empty run makes an
 * empty fragment at `start`. Nothing changes where `parent` names no list.
 */
export function wrapSteps(data: SequenceData, parent: StepPlace['parent'], start: number, end: number, f: NewSeqFragment): SequenceData {
  const list = stepListOf(data.steps, parent);
  const id = f.id ?? freshSeqId(data, 'f');
  if (list === null || seqIdTaken(data, id)) return data;
  const lo = Math.max(0, Math.min(start, end, list.length));
  const hi = Math.max(lo, Math.min(Math.max(start, end), list.length));
  const frag: SeqFragment = {
    kind: 'fragment', id, type: f.type, sections: [{ ...(f.label ? { label: f.label } : {}), steps: list.slice(lo, hi) }],
  };
  return { ...data, steps: withList(data.steps, parent, (l) => [...l.slice(0, lo), frag, ...l.slice(hi)]) };
}

/** Fragment `id` dissolved: its sections' steps, in order, stand where it stood. */
export function unwrapFragment(data: SequenceData, id: string): SequenceData {
  const place = placeOf(data.steps, id);
  const frag = findStep(data.steps, id);
  if (place === null || frag?.kind !== 'fragment') return data;
  const inner = frag.sections.flatMap((sec) => sec.steps);
  return { ...data, steps: withList(data.steps, place.parent, (l) => [...l.slice(0, place.index), ...inner, ...l.slice(place.index + 1)]) };
}

/** `fn` of fragment `id`, where it is one and `fn` changes it. */
function withFragment(data: SequenceData, id: string, fn: (f: SeqFragment) => SeqFragment): SequenceData {
  const steps = mapSteps(data.steps, (s) => (s.kind === 'fragment' && s.id === id ? fn(s) : s));
  return steps === data.steps ? data : { ...data, steps };
}

/** An empty section added to an alt, par, or critical, at `index` among its sections (default last). Other types hold one. */
export function addSection(data: SequenceData, id: string, label?: string, index?: number): SequenceData {
  return withFragment(data, id, (f) => {
    if (!SEQ_MULTI_SECTION.has(f.type)) return f;
    const at = Math.max(1, Math.min(index ?? f.sections.length, f.sections.length));
    const section = { ...(label ? { label } : {}), steps: [] };
    return { ...f, sections: [...f.sections.slice(0, at), section, ...f.sections.slice(at)] };
  });
}

/** Section `index` of fragment `id` removed, with its steps. A fragment's only section stays: remove the fragment instead. */
export function removeSection(data: SequenceData, id: string, index: number): SequenceData {
  return withFragment(data, id, (f) => (f.sections.length < 2 || f.sections[index] === undefined
    ? f
    : { ...f, sections: f.sections.filter((_, k) => k !== index) }));
}

/** Fragment `id` retyped. A fragment with several sections keeps them, so it takes only another type that holds several. */
export function setFragmentType(data: SequenceData, id: string, type: SeqFragment['type']): SequenceData {
  return withFragment(data, id, (f) => (f.type === type || (f.sections.length > 1 && !SEQ_MULTI_SECTION.has(type)) ? f : { ...f, type }));
}

/** `fn` of message `id`, where it is one and `fn` changes it. */
function withMessage(data: SequenceData, id: string, fn: (m: SeqMessage) => SeqMessage): SequenceData {
  const steps = mapSteps(data.steps, (s) => (s.kind === 'message' && s.id === id ? fn(s) : s));
  return steps === data.steps ? data : { ...data, steps };
}

/** Message `id` drawn with `arrow`, a name in {@link SEQ_ARROWS} or an arrow of its own. */
export function setMessageArrow(data: SequenceData, id: string, arrow: SeqArrowName | SeqArrow): SequenceData {
  const next: SeqArrow = typeof arrow === 'object' ? arrow : SEQ_ARROWS[arrow];
  return withMessage(data, id, (m) => {
    if (m.line === next.line && m.head === next.head && m.both === next.both && m.async === next.async) return m;
    const { both: _both, async: _async, ...rest } = m;
    return { ...rest, line: next.line, head: next.head, ...(next.both ? { both: true } : {}), ...(next.async ? { async: true } : {}) };
  });
}

/** Message `id`'s activation flags set: which end it starts an activation on, and which end it ends one on; `undefined` clears one. */
export function setMessageActivation(
  data: SequenceData, id: string, flags: { activate?: 'to' | 'from' | undefined; deactivate?: 'to' | 'from' | undefined },
): SequenceData {
  return withMessage(data, id, (m) => {
    const activate = 'activate' in flags ? flags.activate : m.activate;
    const deactivate = 'deactivate' in flags ? flags.deactivate : m.deactivate;
    if (activate === m.activate && deactivate === m.deactivate) return m;
    const { activate: _a, deactivate: _d, ...rest } = m;
    return { ...rest, ...(activate ? { activate } : {}), ...(deactivate ? { deactivate } : {}) };
  });
}
