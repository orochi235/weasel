import { describe, expect, it } from 'vitest';
import type { SequenceData } from '@weasel-js/diagram';
import type { SequencePage } from '../../document';
import { readMermaidSequence } from './read';
import { writeMermaidSequence } from './write';

const pageOf = (data: SequenceData, name?: string): SequencePage =>
  ({ kind: 'sequence', id: 'p', width: 400, height: 300, data, ...(name !== undefined ? { name } : {}) });
const back = (page: SequencePage) => readMermaidSequence(writeMermaidSequence(page).text).document.pages[0] as SequencePage;

describe('Mermaid sequence, shrunk counterexamples', () => {
  it('writes a participant with a blank label as one with none', () => {
    expect(back(pageOf({ participants: [{ id: 'D7O' }, { id: 'vkey', label: '' }], steps: [] })).data.participants.map((p) => p.id))
      .toEqual(['D7O', 'vkey']);
  });

  it('keeps an ampersand before text it spells as an entity', () => {
    const data: SequenceData = {
      participants: [{ id: 'A' }],
      steps: [{ kind: 'message', id: 'm', from: 'A', to: 'A', line: 'solid', head: 'none', text: '&&#65;' }, { kind: 'note', id: 'n', over: ['A'], text: '&;' }],
    };
    expect(back(pageOf(data)).data.steps.map((s) => (s.kind === 'message' ? s.text : s.kind === 'note' ? s.text : null))).toEqual(['&&#65;', '&;']);
  });

  it('renames a participant id a sequence cannot hold, keeping its text', () => {
    const data: SequenceData = { participants: [{ id: ':' }, { id: 'title' }], steps: [{ kind: 'message', id: 'm', from: ':', to: 'title', line: 'solid', head: 'none' }] };
    const p = back(pageOf(data));
    expect(p.data.participants.map((x) => x.label ?? x.id)).toEqual([':', 'title']);
    expect(p.data.steps).toHaveLength(1);
  });

  it('keeps a title that opens with a colon', () => {
    expect(back(pageOf({ participants: [{ id: 'a' }], steps: [] }, ':::')).name).toBe(':::');
  });
});
