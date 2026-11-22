import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SequenceData } from '@weasel-js/diagram';
import { describe, expect, it } from 'vitest';
import type { DiagramDocument, SequencePage } from '../../document';
import { DIAGRAM_MERMAID } from '../format';
import { readMermaidSequence } from './read';
import { writeMermaidSequence } from './write';

const CHECKOUT = readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'sequence', 'checkout.mmd'), 'utf8');

const pageOf = (text: string) => readMermaidSequence(text).document.pages[0] as SequencePage;
const page = (data: SequenceData, name?: string): SequencePage =>
  ({ kind: 'sequence', id: 'p', width: 800, height: 600, data, ...(name !== undefined ? { name } : {}) });

describe('writeMermaidSequence', () => {
  it('round-trips the fixture: what it writes reads back as the same data and title', () => {
    const first = pageOf(CHECKOUT);
    const written = writeMermaidSequence(first);
    expect(written.warnings).toEqual([]);
    const back = pageOf(written.text);
    expect(back.data).toEqual(first.data);
    expect(back.name).toBe('Checkout');
    expect(writeMermaidSequence(back).text).toBe(written.text);
  });

  it('writes activations Mermaid has no shorthand for as their own lines', () => {
    const text = writeMermaidSequence(page({
      participants: [{ id: 'A' }, { id: 'B' }],
      steps: [{ kind: 'message', id: 'm1', from: 'A', to: 'B', line: 'solid', head: 'arrow', activate: 'from', deactivate: 'to' }],
    })).text;
    expect(text).toBe('sequenceDiagram\n  participant A\n  participant B\n  A->>B:\n  activate A\n  deactivate B\n');
  });

  it('escapes the text Mermaid reads as syntax, and reads it back', () => {
    const data: SequenceData = {
      participants: [{ id: 'A', label: 'a;b' }, { id: 'B' }],
      steps: [{ kind: 'message', id: 'm1', from: 'A', to: 'B', line: 'solid', head: 'arrow', text: '#1 <x>; two\nlines &amp; &#65; a&b' }],
    };
    expect(pageOf(writeMermaidSequence(page(data)).text).data).toEqual(data);
  });

  it('warns about what Mermaid cannot hold', () => {
    const { warnings } = writeMermaidSequence(page({
      participants: [{ id: 'A', outline: 'hexagon', colors: { fill: 'red' } }, { id: 'B' }],
      steps: [
        { kind: 'message', id: 'm1', from: 'A', to: 'B', line: 'solid', head: 'cross', both: true },
        { kind: 'fragment', id: 'f1', type: 'loop', sections: [{ steps: [] }, { steps: [] }] },
      ],
    }));
    expect(warnings).toHaveLength(4);
  });

  it('is what the Mermaid format writes a sequence page as', () => {
    const doc: DiagramDocument = { pages: [pageOf(CHECKOUT)] };
    expect(DIAGRAM_MERMAID.write!(doc).text).toBe(writeMermaidSequence(pageOf(CHECKOUT)).text);
  });

  it('renames a participant whose id the reader takes for a menu statement, so its messages read back', () => {
    for (const id of ['links', 'link', 'properties', 'details']) {
      const data: SequenceData = { participants: [{ id }, { id: 'B' }], steps: [{ kind: 'message', id: 'm1', from: id, to: 'B', line: 'solid', head: 'arrow', text: 'hi' }] };
      expect(pageOf(writeMermaidSequence(page(data)).text).data.steps).toHaveLength(1);
    }
  });

  it('writes a box with no fill whose label opens with a color word as transparent, so the word reads back as label', () => {
    const data: SequenceData = { participants: [{ id: 'a' }], steps: [], boxes: [{ id: 'b1', label: 'red team', members: ['a'] }] };
    expect(pageOf(writeMermaidSequence(page(data)).text).data.boxes).toEqual([{ id: 'b1', label: 'red team', members: ['a'] }]);
  });

  it('declares a box\'s members together, those only its steps name too, with a warning where that moves one', () => {
    const data: SequenceData = {
      participants: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
      steps: [{ kind: 'message', id: 'm1', from: 'A', to: 'D', line: 'solid', head: 'arrow', text: 'x' }],
      boxes: [{ id: 'b1', label: 'Svc', members: ['A', 'C', 'D'] }],
    };
    const out = writeMermaidSequence(page(data));
    expect(out.text).toBe('sequenceDiagram\n  box Svc\n    participant A\n    participant C\n    participant D\n  end\n  participant B\n  A->>D: x\n');
    expect(out.warnings).toEqual(['Mermaid declares a box\'s members together; members declared apart were moved beside each other.']);
    expect(pageOf(out.text).data.boxes).toEqual([{ id: 'b1', label: 'Svc', members: ['A', 'C', 'D'] }]);
  });

  it('warns of a box member a step creates, which Mermaid declares outside the box', () => {
    const out = writeMermaidSequence(page({
      participants: [{ id: 'A' }, { id: 'B' }], steps: [{ kind: 'create', participant: 'B' }, { kind: 'message', id: 'm1', from: 'A', to: 'B', line: 'solid', head: 'arrow' }],
      boxes: [{ id: 'b1', members: ['A', 'B'] }],
    }));
    expect(out.warnings).toEqual(['Participants a step creates were written outside their boxes.']);
  });

  it('writes an autonumber start that is not a number as 1, with a warning, so it reads back', () => {
    const out = writeMermaidSequence(page({ participants: [{ id: 'A' }], steps: [], autonumber: Number.NaN }));
    expect(out.text).toBe('sequenceDiagram\n  autonumber\n  participant A\n');
    expect(out.warnings).toEqual(['Mermaid numbers messages from a number; an autonumber start that is not one was written as 1.']);
    expect(pageOf(out.text).data.autonumber).toBe(1);
  });
});

describe('writing a sequence box\'s or region\'s fill', () => {
  it('drops a fill Mermaid would not read back as a color, with a warning, so a box keeps its label', () => {
    const out = writeMermaidSequence(page({
      participants: [{ id: 'A' }],
      boxes: [{ id: 'b', label: 'Team', members: ['A'], colors: { fill: 'var(--brand)' } }],
      steps: [{ kind: 'fragment', id: 'f', type: 'region', colors: { fill: 'oklch(70% 0.1 200)' }, sections: [{ steps: [] }] }],
    } as SequenceData));
    expect(out.warnings).toContain('Mermaid box and rect colors are hex, rgb(), hsl(), or a color name; others were dropped.');
    expect(pageOf(out.text).data.boxes![0]!.label).toBe('Team');
    expect(out.text).not.toContain('oklch');
  });
});

describe('writing sequence text that a reader would split or misread', () => {
  const msg = (text: string, from = 'A') => ({ kind: 'message' as const, id: 'm1', from, to: 'B', line: 'solid' as const, head: 'arrow' as const, text });

  it('writes a carriage return as a line break, so the text reads back as one statement', () => {
    const out = writeMermaidSequence(page({
      participants: [{ id: 'A', label: 'x\ry' }, { id: 'B' }],
      steps: [msg('a\r\nb'), msg('c\rd'), { kind: 'note', id: 'n1', over: ['A'], text: 'e\r\nf' }],
    }, 'one\rtwo'));
    const back = pageOf(out.text);
    expect(back.name).toBe('one\ntwo');
    expect(back.data.participants[0]!.label).toBe('x\ny');
    expect(back.data.steps.map((s) => (s.kind === 'message' || s.kind === 'note' ? s.text : undefined))).toEqual(['a\nb', 'c\nd', 'e\nf']);
  });

  it('reads a note holding a line or paragraph separator whole', () => {
    const out = writeMermaidSequence(page({ participants: [{ id: 'A' }], steps: [{ kind: 'note', id: 'n1', over: ['A'], text: 'a b c' }] }));
    const note = pageOf(out.text).data.steps[0]!;
    expect(note).toMatchObject({ kind: 'note', text: 'a b c' });
  });

  it('keeps a participant whose id opens with a statement word and goes on with a letter outside ASCII', () => {
    for (const id of ['titleé', 'linksé', 'linké', 'propertiesé', 'detailsé', 'accTitleé', 'accDescré']) {
      const out = writeMermaidSequence(page({ participants: [{ id }, { id: 'B' }], steps: [msg('hi', id)] }));
      const back = pageOf(out.text);
      expect(back.name, id).toBeUndefined();
      expect(back.data.steps[0], id).toMatchObject({ kind: 'message', from: id, to: 'B', text: 'hi' });
    }
  });
});

describe('writing sequence boxes and regions', () => {
  it('writes a box whose members are named only by steps', () => {
    const out = writeMermaidSequence(page({
      participants: [],
      boxes: [{ id: 'b1', label: 'Team', members: ['A', 'B'] }],
      steps: [{ kind: 'message', id: 'm1', from: 'A', to: 'B', line: 'solid', head: 'arrow', text: 'hi' }],
    }));
    expect(out.warnings).toEqual([]);
    expect(pageOf(out.text).data.boxes).toEqual([expect.objectContaining({ label: 'Team', members: ['A', 'B'] })]);
  });

  it('writes a region with no fill so it reads back with none', () => {
    const out = writeMermaidSequence(page({ participants: [{ id: 'A' }], steps: [{ kind: 'fragment', id: 'f', type: 'region', sections: [{ steps: [] }] }] }));
    expect(pageOf(out.text).data.steps[0]).not.toHaveProperty('colors');
  });

  it('drops a note over no participant, with a warning, so the text reads back', () => {
    const out = writeMermaidSequence(page({ participants: [{ id: 'A' }], steps: [{ kind: 'note', id: 'n', over: [], text: 'x' }] }));
    expect(out.warnings).toContain('Mermaid notes stand beside or over a participant; notes over none were dropped.');
    expect(pageOf(out.text).data.steps).toEqual([]);
  });
});
