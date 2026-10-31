import { describe, expect, it } from 'vitest';
import {
  addSection, insertMark, insertMessage, insertNote, insertStep, removeSection, removeStep, removeStepAt, setFragmentType,
  setMessageActivation, setMessageArrow, unwrapFragment, wrapSteps,
} from './authorSteps';
import { findStep } from './edit';
import { SEQ_FIXTURE as data } from './fixture';
import type { SeqStep } from './types';

const ids = (steps: readonly SeqStep[]) => steps.map((s) => ('id' in s ? s.id : s.kind));
const top = (index: number) => ({ parent: null, index });

describe('insertMessage', () => {
  it('inserts a message with a fresh id and a named arrow, into a section too', () => {
    const next = insertMessage(data, { from: 'c', to: 'a', at: top(1), arrow: 'reply', text: 'back' });
    expect(next.steps[1]).toEqual({ kind: 'message', id: 'm6', from: 'c', to: 'a', line: 'dashed', head: 'arrow', text: 'back' });
    const inner = insertMessage(data, { from: 'a', to: 'a', at: { parent: { fragment: 'f1', section: 1 }, index: 0 }, arrow: 'async', id: 'self' });
    const frag = findStep(inner.steps, 'f1');
    expect(frag?.kind === 'fragment' && ids(frag.sections[1]!.steps)).toEqual(['self', 'm3']);
    expect(findStep(inner.steps, 'self')).toMatchObject({ head: 'open', async: true });
  });

  it('refuses an unknown participant, a missing list, or a taken id', () => {
    expect(insertMessage(data, { from: 'a', to: 'zed', at: top(0) })).toBe(data);
    expect(insertMessage(data, { from: 'a', to: 'b', at: { parent: { fragment: 'nope', section: 0 }, index: 0 } })).toBe(data);
    expect(insertMessage(data, { from: 'a', to: 'b', at: top(0), id: 'n1' })).toBe(data);
  });

  it('clamps the index to the list', () => {
    expect(ids(insertMessage(data, { from: 'a', to: 'b', at: top(99) }).steps).at(-1)).toBe('m6');
  });
});

describe('insertNote and insertMark', () => {
  it('inserts a note over a span, or beside one participant', () => {
    expect(insertNote(data, { over: ['a', 'c'], at: top(0) }).steps[0]).toEqual({ kind: 'note', id: 'n2', over: ['a', 'c'], text: 'Note' });
    expect(insertNote(data, { over: ['b', 'c'], side: 'left', at: top(0), text: 'x' }).steps[0])
      .toEqual({ kind: 'note', id: 'n2', over: ['b'], side: 'left', text: 'x' });
    expect(insertNote(data, { over: [], at: top(0) })).toBe(data);
  });

  it('inserts activations, creations, and destructions, a participant created once', () => {
    const next = insertMark(insertMark(data, { kind: 'create', participant: 'c' }, top(2)), { kind: 'activate', participant: 'b' }, top(0));
    expect(next.steps[0]).toEqual({ kind: 'activate', participant: 'b' });
    expect(next.steps[3]).toEqual({ kind: 'create', participant: 'c' });
    expect(insertMark(next, { kind: 'create', participant: 'c' }, top(0))).toBe(next);
    expect(insertMark(data, { kind: 'destroy', participant: 'zed' }, top(0))).toBe(data);
  });
});

describe('removing steps', () => {
  it('removes a step by id at any depth, a fragment with what it holds', () => {
    expect(findStep(removeStep(data, 'm3').steps, 'm3')).toBeNull();
    expect(ids(removeStep(data, 'f1').steps)).toEqual(['m1', 'n1', 'm4', 'm5']);
    expect(removeStep(data, 'nope')).toBe(data);
  });

  it('removes a mark by its place', () => {
    const marked = insertStep(data, { kind: 'deactivate', participant: 'b' }, { parent: { fragment: 'f1', section: 0 }, index: 1 });
    expect(removeStepAt(marked, { parent: { fragment: 'f1', section: 0 }, index: 1 })).toEqual(data);
    expect(removeStepAt(data, top(9))).toBe(data);
  });
});

describe('fragments', () => {
  it('wraps a run of steps where they stood, and an empty run as an empty fragment', () => {
    const next = wrapSteps(data, null, 2, 4, { type: 'loop', label: 'every minute' });
    expect(ids(next.steps)).toEqual(['m1', 'f1', 'f2', 'm5']);
    expect(findStep(next.steps, 'f2')).toEqual({
      kind: 'fragment', id: 'f2', type: 'loop', sections: [{ label: 'every minute', steps: [data.steps[2], data.steps[3]] }],
    });
    const empty = wrapSteps(data, { fragment: 'f1', section: 0 }, 1, 1, { type: 'opt', id: 'o' });
    const f1 = findStep(empty.steps, 'f1');
    expect(f1?.kind === 'fragment' && ids(f1.sections[0]!.steps)).toEqual(['m2', 'o']);
  });

  it('dissolves a fragment into the steps it held', () => {
    expect(ids(unwrapFragment(data, 'f1').steps)).toEqual(['m1', 'm2', 'm3', 'n1', 'm4', 'm5']);
    expect(unwrapFragment(data, 'm1')).toBe(data);
  });

  it('adds a section only to the types that hold several, and keeps a fragment\'s last', () => {
    const three = addSection(data, 'f1', 'is away');
    const f = findStep(three.steps, 'f1');
    expect(f?.kind === 'fragment' && f.sections.map((s) => s.label)).toEqual(['is well', 'is sick', 'is away']);
    const loop = wrapSteps(data, null, 0, 1, { type: 'loop', id: 'L' });
    expect(addSection(loop, 'L')).toBe(loop);
    const two = removeSection(three, 'f1', 0);
    const g = findStep(two.steps, 'f1');
    expect(g?.kind === 'fragment' && g.sections.map((s) => s.label)).toEqual(['is sick', 'is away']);
    expect(removeSection(loop, 'L', 0)).toBe(loop);
  });

  it('retypes a fragment only to a type that holds its sections', () => {
    expect(findStep(setFragmentType(data, 'f1', 'par').steps, 'f1')).toMatchObject({ type: 'par' });
    expect(setFragmentType(data, 'f1', 'loop')).toBe(data);
  });
});

describe('messages', () => {
  it('sets an arrow, dropping the flags it does not carry', () => {
    const both = setMessageArrow(data, 'm1', 'both');
    expect(findStep(both.steps, 'm1')).toMatchObject({ line: 'solid', head: 'arrow', both: true });
    const reply = setMessageArrow(both, 'm1', 'reply');
    expect('both' in findStep(reply.steps, 'm1')!).toBe(false);
    expect(setMessageArrow(data, 'm2', 'reply')).toBe(data);
  });

  it('sets and clears activation flags', () => {
    const next = setMessageActivation(data, 'm1', { activate: undefined, deactivate: 'from' });
    const m = findStep(next.steps, 'm1');
    expect(m?.kind === 'message' && [m.activate, m.deactivate]).toEqual([undefined, 'from']);
    expect(setMessageActivation(data, 'm1', { activate: 'to' })).toBe(data);
  });
});
