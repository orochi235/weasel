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
      steps: [{ kind: 'message', id: 'm1', from: 'A', to: 'B', line: 'solid', head: 'arrow', text: '#1 <x>; two\nlines' }],
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
});
