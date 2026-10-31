/**
 * The edits a sequence takes, each a pure function from one `SequenceData` to
 * the next. A no-op returns the data it was given, so a caller can tell
 * nothing changed by identity.
 */
import type { SeqFragment, SeqStep, SeqTextTarget, SequenceData, StepPlace } from './types';

type Steps = readonly SeqStep[];

const hasId = (s: SeqStep): s is Extract<SeqStep, { id: string }> => 'id' in s;

/** The step list `parent` names: the top level, or one section of a fragment anywhere in `steps`. `null` when there is none. */
export function stepListOf(steps: Steps, parent: StepPlace['parent']): Steps | null {
  if (parent === null) return steps;
  const frag = findStep(steps, parent.fragment);
  return frag?.kind === 'fragment' ? frag.sections[parent.section]?.steps ?? null : null;
}

/** The step with `id`, at any depth. */
export function findStep(steps: Steps, id: string): SeqStep | null {
  for (const s of steps) {
    if (hasId(s) && s.id === id) return s;
    if (s.kind === 'fragment') {
      for (const section of s.sections) {
        const found = findStep(section.steps, id);
        if (found !== null) return found;
      }
    }
  }
  return null;
}

/** Where the step with `id` stands. */
export function placeOf(steps: Steps, id: string, parent: StepPlace['parent'] = null): StepPlace | null {
  for (const [index, s] of steps.entries()) {
    if (hasId(s) && s.id === id) return { parent, index };
    if (s.kind === 'fragment') {
      for (const [k, section] of s.sections.entries()) {
        const found = placeOf(section.steps, id, { fragment: s.id, section: k });
        if (found !== null) return found;
      }
    }
  }
  return null;
}

/** `steps` with every step `fn` maps, fragments' sections included, rebuilt only along changed paths. */
function mapSteps(steps: Steps, fn: (s: SeqStep) => SeqStep): Steps {
  let changed = false;
  const out = steps.map((s) => {
    let next = fn(s);
    if (next.kind === 'fragment') {
      const frag = next;
      const sections = frag.sections.map((section) => {
        const inner = mapSteps(section.steps, fn);
        return inner === section.steps ? section : { ...section, steps: inner };
      });
      if (sections.some((sec, k) => sec !== frag.sections[k])) next = { ...frag, sections };
    }
    if (next !== s) changed = true;
    return next;
  });
  return changed ? out : steps;
}

/** `steps` with the list at `parent` replaced by `fn` of it. */
function withList(steps: Steps, parent: StepPlace['parent'], fn: (list: Steps) => Steps): Steps {
  if (parent === null) return fn(steps);
  return mapSteps(steps, (s) => {
    if (s.kind !== 'fragment' || s.id !== parent.fragment) return s;
    const sections = s.sections.map((sec, k) => (k === parent.section ? { ...sec, steps: fn(sec.steps) } : sec));
    return { ...s, sections } satisfies SeqFragment;
  });
}

const contains = (step: SeqStep, id: string): boolean =>
  step.kind === 'fragment' && step.sections.some((sec) => sec.steps.some((s) => (hasId(s) && s.id === id) || contains(s, id)));

/**
 * The step `id` moved to `to`, whose `index` counts the list as it stands
 * before the move. A fragment cannot move into itself.
 */
export function moveStep(data: SequenceData, id: string, to: StepPlace): SequenceData {
  const from = placeOf(data.steps, id);
  const step = findStep(data.steps, id);
  if (from === null || step === null) return data;
  if (to.parent !== null && (to.parent.fragment === id || contains(step, to.parent.fragment))) return data;
  if (stepListOf(data.steps, to.parent) === null) return data;
  const sameList = JSON.stringify(from.parent) === JSON.stringify(to.parent);
  if (sameList && (to.index === from.index || to.index === from.index + 1)) return data;
  const removed = withList(data.steps, from.parent, (list) => list.filter((_, i) => i !== from.index));
  const index = sameList && to.index > from.index ? to.index - 1 : to.index;
  const steps = withList(removed, to.parent, (list) => [...list.slice(0, index), step, ...list.slice(index)]);
  return { ...data, steps };
}

/** Participant `id` moved to `index` among them, counted as they stand before the move. */
export function moveParticipant(data: SequenceData, id: string, index: number): SequenceData {
  const from = data.participants.findIndex((p) => p.id === id);
  if (from < 0 || index === from || index === from + 1) return data;
  const p = data.participants[from]!;
  const rest = data.participants.filter((_, i) => i !== from);
  const at = index > from ? index - 1 : index;
  return { ...data, participants: [...rest.slice(0, at), p, ...rest.slice(at)] };
}

/** Message `id`'s `end` moved to `participant`'s lifeline. */
export function reconnectMessage(data: SequenceData, id: string, end: 'from' | 'to', participant: string): SequenceData {
  const step = findStep(data.steps, id);
  if (step?.kind !== 'message' || step[end] === participant || !data.participants.some((p) => p.id === participant)) return data;
  return { ...data, steps: mapSteps(data.steps, (s) => (s === step ? { ...step, [end]: participant } : s)) };
}

/** `data` with `target`'s text set to `text`. Empty text clears a label; a note keeps its text as given. */
export function setSequenceText(data: SequenceData, target: SeqTextTarget, text: string): SequenceData {
  if ('participant' in target) {
    const at = data.participants.findIndex((p) => p.id === target.participant);
    const p = data.participants[at];
    if (p === undefined || (p.label ?? p.id) === text) return data;
    const { label: _label, ...rest } = p;
    const next = text === '' || text === p.id ? rest : { ...rest, label: text };
    return { ...data, participants: data.participants.map((q, i) => (i === at ? next : q)) };
  }
  if ('box' in target) {
    const boxes = data.boxes?.map((b) => {
      if (b.id !== target.box || (b.label ?? '') === text) return b;
      const { label: _label, ...rest } = b;
      return text === '' ? rest : { ...rest, label: text };
    });
    return boxes === undefined || boxes.every((b, i) => b === data.boxes![i]) ? data : { ...data, boxes };
  }
  if ('fragment' in target) {
    const steps = mapSteps(data.steps, (s) => {
      if (s.kind !== 'fragment' || s.id !== target.fragment) return s;
      const section = s.sections[target.section];
      if (section === undefined || (section.label ?? '') === text) return s;
      const { label: _label, ...rest } = section;
      const next = text === '' ? rest : { ...rest, label: text };
      return { ...s, sections: s.sections.map((sec, k) => (k === target.section ? next : sec)) };
    });
    return steps === data.steps ? data : { ...data, steps };
  }
  const steps = mapSteps(data.steps, (s) => {
    if (s.kind === 'note' && s.id === target.step && s.text !== text) return { ...s, text };
    if (s.kind !== 'message' || s.id !== target.step || (s.text ?? '') === text) return s;
    const { text: _text, ...rest } = s;
    return text === '' ? rest : { ...rest, text };
  });
  return steps === data.steps ? data : { ...data, steps };
}

/** The text `target` holds in `data`, as an edit opens on it. */
export function sequenceTextOf(data: SequenceData, target: SeqTextTarget): string | null {
  if ('participant' in target) {
    const p = data.participants.find((q) => q.id === target.participant);
    return p === undefined ? null : p.label ?? p.id;
  }
  if ('box' in target) {
    const b = data.boxes?.find((q) => q.id === target.box);
    return b === undefined ? null : b.label ?? '';
  }
  if ('fragment' in target) {
    const f = findStep(data.steps, target.fragment);
    const section = f?.kind === 'fragment' ? f.sections[target.section] : undefined;
    return section === undefined ? null : section.label ?? '';
  }
  const s = findStep(data.steps, target.step);
  return s?.kind === 'message' ? s.text ?? '' : s?.kind === 'note' ? s.text : null;
}
