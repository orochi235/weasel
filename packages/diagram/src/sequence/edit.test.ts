import { describe, expect, it } from 'vitest';
import { findStep, moveParticipant, moveStep, placeOf, reconnectMessage, sequenceTextOf, setSequenceText } from './edit';
import { SEQ_FIXTURE as data } from './fixture';
import type { SeqStep } from './types';

const ids = (steps: readonly SeqStep[]) => steps.map((s) => ('id' in s ? s.id : s.kind));

describe('moveStep', () => {
  it('moves a message down the top level, counting the list as it stood', () => {
    const next = moveStep(data, 'm1', { parent: null, index: 3 });
    expect(ids(next.steps)).toEqual(['f1', 'n1', 'm1', 'm4', 'm5']);
  });

  it('moves a message into a fragment section and out again', () => {
    const into = moveStep(data, 'm5', { parent: { fragment: 'f1', section: 1 }, index: 0 });
    const frag = findStep(into.steps, 'f1');
    expect(frag?.kind === 'fragment' && ids(frag.sections[1]!.steps)).toEqual(['m5', 'm3']);
    expect(ids(into.steps)).not.toContain('m5');
    const out = moveStep(into, 'm2', { parent: null, index: 0 });
    expect(ids(out.steps)[0]).toBe('m2');
    expect(placeOf(out.steps, 'm5')).toEqual({ parent: { fragment: 'f1', section: 1 }, index: 0 });
  });

  it('leaves the data alone for a drop where the step already is, or a fragment into itself', () => {
    expect(moveStep(data, 'm1', { parent: null, index: 0 })).toBe(data);
    expect(moveStep(data, 'm1', { parent: null, index: 1 })).toBe(data);
    expect(moveStep(data, 'f1', { parent: { fragment: 'f1', section: 0 }, index: 0 })).toBe(data);
    expect(moveStep(data, 'nope', { parent: null, index: 0 })).toBe(data);
  });
});

describe('moveParticipant', () => {
  it('moves a participant right and left', () => {
    expect(moveParticipant(data, 'a', 3).participants.map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(moveParticipant(data, 'c', 0).participants.map((p) => p.id)).toEqual(['c', 'a', 'b']);
    expect(moveParticipant(data, 'b', 2)).toBe(data);
  });
});

describe('reconnectMessage', () => {
  it('moves one end to another lifeline, inside a fragment too', () => {
    const next = reconnectMessage(data, 'm2', 'to', 'c');
    const m = findStep(next.steps, 'm2');
    expect(m?.kind === 'message' && [m.from, m.to]).toEqual(['b', 'c']);
    expect(reconnectMessage(data, 'm2', 'to', 'a')).toBe(data);
    expect(reconnectMessage(data, 'm2', 'to', 'zed')).toBe(data);
  });
});

describe('setSequenceText', () => {
  it('sets a head, a message, a note, a section label, and reads them back', () => {
    let next = setSequenceText(data, { participant: 'b' }, 'Robert');
    next = setSequenceText(next, { step: 'm3' }, 'Bad');
    next = setSequenceText(next, { step: 'n1' }, 'Usual');
    next = setSequenceText(next, { fragment: 'f1', section: 0 }, 'ok');
    expect(sequenceTextOf(next, { participant: 'b' })).toBe('Robert');
    expect(sequenceTextOf(next, { step: 'm3' })).toBe('Bad');
    expect(sequenceTextOf(next, { step: 'n1' })).toBe('Usual');
    expect(sequenceTextOf(next, { fragment: 'f1', section: 0 })).toBe('ok');
  });

  it('clears a message text set empty, and returns the same data when nothing changes', () => {
    const cleared = setSequenceText(data, { step: 'm1' }, '');
    const m = findStep(cleared.steps, 'm1');
    expect(m?.kind === 'message' && 'text' in m).toBe(false);
    expect(setSequenceText(data, { participant: 'a' }, 'Alice')).toBe(data);
  });
});
