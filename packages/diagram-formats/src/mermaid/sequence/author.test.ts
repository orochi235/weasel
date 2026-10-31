import {
  addBox, addParticipant, addSection, insertMark, insertMessage, insertNote, newParticipant, setAutonumber, setMessageActivation,
  setSequenceText, wrapSteps, type SeqStep, type SequenceData,
} from '@weasel-js/diagram';
import { describe, expect, it } from 'vitest';
import type { SequencePage } from '../../document';
import { readMermaidSequence } from './read';
import { writeMermaidSequence } from './write';

const EMPTY: SequenceData = { participants: [], steps: [] };
const top = (index: number) => ({ parent: null, index });

/** `data` with its steps' and boxes' ids renumbered in document order, as the reader mints them. */
function renumbered(data: SequenceData): SequenceData {
  const counts = { m: 0, n: 0, f: 0 };
  const walk = (steps: readonly SeqStep[]): SeqStep[] => steps.map((s) => {
    if (s.kind === 'message') return { ...s, id: `m${++counts.m}` };
    if (s.kind === 'note') return { ...s, id: `n${++counts.n}` };
    if (s.kind !== 'fragment') return s;
    const id = `f${++counts.f}`;
    return { ...s, id, sections: s.sections.map((sec) => ({ ...sec, steps: walk(sec.steps) })) };
  });
  return { ...data, steps: walk(data.steps), ...(data.boxes ? { boxes: data.boxes.map((b, i) => ({ ...b, id: `b${i + 1}` })) } : {}) };
}

/** A sequence authored from nothing with the ops: every kind of thing the model holds that Mermaid writes. */
function authored(): SequenceData {
  let d = EMPTY;
  for (const kind of ['actor', 'participant', 'participant', 'participant'] as const) d = addParticipant(d, newParticipant(d, kind));
  const [a, p1, p2, p3] = d.participants.map((p) => p.id) as [string, string, string, string];
  d = setSequenceText(d, { participant: p1 }, 'Web app');
  d = insertMessage(d, { from: a, to: p1, at: top(0), text: 'Place order' });
  d = setMessageActivation(d, 'm1', { activate: 'to' });
  d = insertMessage(d, { from: p1, to: p2, at: top(1), arrow: 'async', text: 'POST' });
  d = insertMessage(d, { from: p2, to: p1, at: top(2), arrow: 'reply', text: 'ok' });
  d = insertMessage(d, { from: p2, to: p1, at: top(3), arrow: 'lost', text: 'declined' });
  d = wrapSteps(d, null, 2, 4, { type: 'alt', label: 'card accepted' });
  d = addSection(d, 'f1', 'declined');
  d = insertMessage(d, { from: p1, to: p1, at: { parent: { fragment: 'f1', section: 1 }, index: 0 }, arrow: 'both', text: 'retry' });
  d = wrapSteps(d, null, 1, 2, { type: 'loop', label: 'until done' });
  d = insertNote(d, { over: [p1, p2], at: top(3), text: 'retries twice' });
  d = insertNote(d, { over: [a], side: 'right', at: top(4), text: 'waits' });
  d = insertMark(d, { kind: 'deactivate', participant: p1 }, top(5));
  d = insertMark(d, { kind: 'create', participant: p3 }, top(6));
  d = insertMessage(d, { from: p1, to: p3, at: top(7), arrow: 'line' });
  d = insertMark(d, { kind: 'destroy', participant: p3 }, top(8));
  d = addBox(d, { id: 'b9', label: 'Backend', members: [p2] });
  return setAutonumber(d, 1);
}

describe('a sequence authored with the ops', () => {
  it('writes to Mermaid without a warning and reads back as the same data', () => {
    const data = authored();
    const page: SequencePage = { kind: 'sequence', id: 'p', width: 800, height: 600, data };
    const written = writeMermaidSequence(page);
    expect(written.warnings).toEqual([]);
    for (const line of ['autonumber', 'box Backend', 'loop until done', 'else declined', 'create participant P3', 'destroy P3', 'Note right of A1']) {
      expect(written.text).toContain(line);
    }
    const back = readMermaidSequence(written.text);
    expect(back.warnings).toEqual([]);
    expect((back.document.pages[0] as SequencePage).data).toEqual(renumbered(data));
  });
});
