import { describe, expect, it } from 'vitest';
import {
  addBox, addParticipant, freshSeqId, newParticipant, removeBox, removeParticipant, setAutonumber, setParticipantOutline,
} from './author';
import { findStep } from './edit';
import { SEQ_FIXTURE as data } from './fixture';
import type { SequenceData } from './types';

const ids = (d: SequenceData) => d.participants.map((p) => p.id);

describe('freshSeqId and newParticipant', () => {
  it('mints the lowest number no participant, step, or box has', () => {
    expect(freshSeqId(data, 'm')).toBe('m6');
    expect(freshSeqId(data, 'f')).toBe('f2');
    expect(freshSeqId(data, 'x')).toBe('x1');
    expect(newParticipant(data)).toEqual({ id: 'P1', label: 'Participant 1' });
    expect(newParticipant(data, 'actor')).toEqual({ id: 'A1', label: 'Actor 1', outline: 'actor' });
  });
});

describe('addParticipant', () => {
  it('adds at an index, last by default, and refuses a taken id', () => {
    expect(ids(addParticipant(data, { id: 'd' }))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(addParticipant(data, { id: 'd' }, 1))).toEqual(['a', 'd', 'b', 'c']);
    expect(addParticipant(data, { id: 'b' })).toBe(data);
    expect(addParticipant(data, { id: 'm1' })).toBe(data);
  });
});

describe('removeParticipant', () => {
  it('takes every message to or from it, its marks, and it from notes and boxes, at any depth', () => {
    const boxed = addBox(data, { id: 'b1', members: ['a', 'b'] });
    const marked: SequenceData = { ...boxed, steps: [...boxed.steps, { kind: 'destroy', participant: 'a' }] };
    const next = removeParticipant(marked, 'a');
    expect(ids(next)).toEqual(['b', 'c']);
    expect(findStep(next.steps, 'm1')).toBeNull();
    const frag = findStep(next.steps, 'f1');
    expect(frag?.kind === 'fragment' && frag.sections.map((s) => s.steps.length)).toEqual([0, 0]);
    const note = findStep(next.steps, 'n1');
    expect(note?.kind === 'note' && note.over).toEqual(['b']);
    expect(next.steps.some((s) => s.kind === 'destroy')).toBe(false);
    expect(next.boxes).toEqual([{ id: 'b1', members: ['b'] }]);
  });

  it('drops a note or box left naming no one, and is a no-op for an unknown id', () => {
    const one: SequenceData = {
      participants: [{ id: 'x' }, { id: 'y' }],
      steps: [{ kind: 'note', id: 'n1', over: ['x'], text: 'hi' }],
      boxes: [{ id: 'b1', members: ['x'] }],
    };
    expect(removeParticipant(one, 'x')).toEqual({ participants: [{ id: 'y' }], steps: [] });
    expect(removeParticipant(one, 'zed')).toBe(one);
  });
});

describe('setParticipantOutline', () => {
  it('sets and clears a figure', () => {
    const next = setParticipantOutline(data, 'b', 'actor');
    expect(next.participants[1]).toEqual({ id: 'b', label: 'Bob', outline: 'actor' });
    expect(setParticipantOutline(next, 'b', 'rect').participants[1]).toEqual({ id: 'b', label: 'Bob' });
    expect(setParticipantOutline(data, 'b', undefined)).toBe(data);
  });
});

describe('boxes', () => {
  it('gathers a box\'s members side by side where its first stands, and takes them from another box', () => {
    const one = addBox(data, { id: 'b1', label: 'Front', members: ['a', 'c', 'zed'] });
    expect(ids(one)).toEqual(['a', 'c', 'b']);
    expect(one.boxes).toEqual([{ id: 'b1', label: 'Front', members: ['a', 'c'] }]);
    const two = addBox(one, { id: 'b2', members: ['a', 'c'] });
    expect(two.boxes).toEqual([{ id: 'b2', members: ['a', 'c'] }]);
    expect(addBox(data, { id: 'b1', members: ['zed'] })).toBe(data);
  });

  it('removes a box and leaves its members', () => {
    const boxed = addBox(data, { id: 'b1', members: ['b'] });
    expect(removeBox(boxed, 'b1')).toEqual(data);
    expect(removeBox(data, 'b1')).toBe(data);
  });
});

describe('setAutonumber', () => {
  it('numbers from a start and stops numbering', () => {
    const on = setAutonumber(data, 3);
    expect(on.autonumber).toBe(3);
    expect('autonumber' in setAutonumber(on, undefined)).toBe(false);
    expect(setAutonumber(data, undefined)).toBe(data);
  });
});
