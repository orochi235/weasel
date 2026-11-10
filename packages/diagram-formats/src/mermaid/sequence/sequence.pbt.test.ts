import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { SeqMessage, SeqNote, SeqParticipant, SeqStep, SequenceData } from '@weasel-js/diagram';
import { idText, oddText, runs, timeoutFor } from '../../pbt.fixture';
import type { SequencePage } from '../../document';
import { readMermaidSequence } from './read';
import { writeMermaidSequence } from './write';

const RUNS = runs(150);
const TIMEOUT = timeoutFor(150, 30);

const pageOf = (data: SequenceData, name?: string): SequencePage =>
  ({ kind: 'sequence', id: 'p', width: 400, height: 300, data, ...(name !== undefined ? { name } : {}) });
const back = (page: SequencePage) => readMermaidSequence(writeMermaidSequence(page).text).document.pages[0] as SequencePage;

const ARROWS = [
  ['solid', 'none', false], ['dashed', 'none', false], ['solid', 'arrow', false], ['dashed', 'arrow', false], ['solid', 'arrow', true],
  ['dashed', 'arrow', true], ['solid', 'cross', false], ['dashed', 'cross', false], ['solid', 'open', false], ['dashed', 'open', false],
] as const;

/** Participants, and messages and notes between them, some in a loop or an alt. */
function sequence(ids: fc.Arbitrary<string[]>): fc.Arbitrary<SequenceData> {
  return ids.chain((pids) => {
    const who = fc.constantFrom(...pids);
    const participant = (id: string): fc.Arbitrary<SeqParticipant> => fc.record({
      label: fc.option(oddText, { nil: undefined }),
      outline: fc.constantFrom(undefined, 'actor', 'boundary', 'control', 'entity', 'cylinder', 'collections', 'queue'),
    }).map(({ label, outline }) => ({ id, ...(label !== undefined ? { label } : {}), ...(outline !== undefined ? { outline } : {}) }));
    const message: fc.Arbitrary<SeqMessage> = fc.record({ from: who, to: who, text: fc.option(oddText, { nil: undefined }), arrow: fc.constantFrom(...ARROWS) })
      .map(({ from, to, text, arrow: [line, head, both] }) => ({
        kind: 'message', id: 'm', from, to, line, head, ...(both ? { both: true } : {}), ...(head === 'open' ? { async: true } : {}),
        ...(text !== undefined ? { text } : {}),
      }));
    const note: fc.Arbitrary<SeqNote> = fc.record({ over: fc.uniqueArray(who, { minLength: 1, maxLength: 2 }), side: fc.constantFrom(undefined, 'left', 'right'), text: oddText })
      .map(({ over, side, text }) => ({ kind: 'note', id: 'n', over: side === undefined ? over : over.slice(0, 1), ...(side !== undefined ? { side } : {}), text }));
    const step = fc.oneof({ weight: 3, arbitrary: message }, { weight: 1, arbitrary: note });
    const fragment: fc.Arbitrary<SeqStep> = fc.record({
      type: fc.constantFrom('loop', 'alt') as fc.Arbitrary<'loop' | 'alt'>,
      sections: fc.array(fc.record({ label: fc.option(oddText, { nil: undefined }), steps: fc.array(step, { minLength: 1, maxLength: 3 }) }), { minLength: 1, maxLength: 2 }),
    }).map(({ type, sections }) => ({
      kind: 'fragment', id: 'f', type,
      sections: (type === 'loop' ? sections.slice(0, 1) : sections).map((s) => ({ ...(s.label !== undefined ? { label: s.label } : {}), steps: s.steps })),
    }));
    return fc.tuple(fc.tuple(...pids.map(participant)), fc.array(fc.oneof({ weight: 4, arbitrary: step }, { weight: 1, arbitrary: fragment }), { maxLength: 6 }))
      .map(([participants, steps]) => ({ participants, steps }));
  });
}

/** What a reader keeps of a step: its kind, ends, arrow, and text as Mermaid reads it; ids are the reader's own. */
function shape(steps: readonly SeqStep[]): unknown[] {
  const text = (t: string | undefined) => (t === undefined || t.trim() === '' ? undefined : t.trim());
  return steps.map((s) => {
    if (s.kind === 'message') return ['message', s.from, s.to, s.line, s.head, s.both === true, text(s.text)];
    if (s.kind === 'note') return ['note', s.over, s.side, s.text.trim()];
    if (s.kind === 'fragment') return ['fragment', s.type, s.sections.map((sec) => [text(sec.label), shape(sec.steps)])];
    return [s.kind, s.participant];
  });
}

const plainIds = fc.uniqueArray(fc.stringMatching(/^[A-Za-z][0-9_]{0,5}$/), { minLength: 1, maxLength: 4 });

describe('Mermaid sequence, property', () => {
  it('reads back what it writes: participants, labels, outlines, messages, notes, and fragments', () => {
    fc.assert(fc.property(sequence(plainIds), (data) => {
      const p = back(pageOf(data));
      expect(p.data.participants.map((x) => [x.id, x.label, x.outline])).toEqual(
        data.participants.map((x) => {
          const label = x.label === undefined || x.label.trim() === '' ? undefined : x.label.trim();
          return [x.id, label === x.id ? undefined : label, x.outline];
        }),
      );
      expect(shape(p.data.steps)).toEqual(shape(data.steps));
    }), RUNS);
  }, TIMEOUT);

  it('writes any participant ids so they read back, and writing is a fixed point after one read', () => {
    fc.assert(fc.property(sequence(fc.uniqueArray(idText, { minLength: 1, maxLength: 4 })), oddText, (data, name) => {
      const first = back(pageOf(data, name));
      const shown = (p: SeqParticipant) => [p.label, p.id].find((t) => t !== undefined && t.trim() !== '')?.trim();
      expect(first.data.participants.map((p) => p.label ?? p.id)).toEqual(data.participants.map((p, i) => shown(p) ?? first.data.participants[i]!.id));
      expect(first.name).toBe(name.trim());
      const once = writeMermaidSequence(first).text;
      expect(writeMermaidSequence(readMermaidSequence(once).document.pages[0] as SequencePage).text).toBe(once);
    }), RUNS);
  }, TIMEOUT);
});
