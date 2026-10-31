import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findStep, type SeqMessage, type SequenceData } from '@weasel-js/diagram';
import { describe, expect, it } from 'vitest';
import type { SequencePage } from '../../document';
import { DIAGRAM_MERMAID } from '../format';
import { readMermaidSequence } from './read';

const CHECKOUT = readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'sequence', 'checkout.mmd'), 'utf8');

const pageOf = (text: string) => readMermaidSequence(text).document.pages[0] as SequencePage;
const dataOf = (text: string): SequenceData => pageOf(text).data;
const message = (data: SequenceData, id: string) => findStep(data.steps, id) as SeqMessage;

describe('readMermaidSequence', () => {
  const page = pageOf(CHECKOUT);
  const { data } = page;

  it('reads participants with aliases, types, and boxes, and the title as the page name', () => {
    expect(page.kind).toBe('sequence');
    expect(page.name).toBe('Checkout');
    expect(data.participants.map((p) => [p.id, p.label, p.outline])).toEqual([
      ['U', 'Shopper', 'actor'], ['W', 'Web\napp', undefined], ['API', undefined, 'boundary'], ['DB', undefined, 'cylinder'],
      ['Q', 'Events', 'queue'], ['L', 'Ledger', undefined],
    ]);
    expect(data.boxes).toEqual([{ id: 'b1', label: 'Storefront', members: ['U', 'W'], colors: { fill: 'Aqua' } }]);
    expect(data.autonumber).toBe(3);
  });

  it('reads every arrow form', () => {
    const arrows = (text: string) => {
      const m = dataOf(`sequenceDiagram\nA${text}B: x`).steps[0] as SeqMessage;
      return [m.line, m.head, m.both ?? false, m.async ?? false];
    };
    expect(arrows('->')).toEqual(['solid', 'none', false, false]);
    expect(arrows('-->')).toEqual(['dashed', 'none', false, false]);
    expect(arrows('->>')).toEqual(['solid', 'arrow', false, false]);
    expect(arrows('-->>')).toEqual(['dashed', 'arrow', false, false]);
    expect(arrows('-x')).toEqual(['solid', 'cross', false, false]);
    expect(arrows('--x')).toEqual(['dashed', 'cross', false, false]);
    expect(arrows('-)')).toEqual(['solid', 'open', false, true]);
    expect(arrows('--)')).toEqual(['dashed', 'open', false, true]);
    expect(arrows('<<->>')).toEqual(['solid', 'arrow', true, false]);
    expect(arrows('<<-->>')).toEqual(['dashed', 'arrow', true, false]);
  });

  it('reads + and - as activating the target and deactivating the sender', () => {
    expect(message(data, 'm1')).toMatchObject({ from: 'U', to: 'W', activate: 'to', text: 'Place order' });
    const done = data.steps.find((s) => s.kind === 'message' && s.text === 'done') as SeqMessage;
    expect(done).toMatchObject({ from: 'W', to: 'U', deactivate: 'from' });
    expect(data.steps).toContainEqual({ kind: 'activate', participant: 'API' });
    expect(data.steps).toContainEqual({ kind: 'deactivate', participant: 'API' });
  });

  it('reads fragments with their sections, and rect as a colored region', () => {
    const types = data.steps.flatMap((s) => (s.kind === 'fragment' ? [[s.type, s.sections.map((sec) => sec.label ?? null)]] : []));
    expect(types).toEqual([
      ['alt', ['card accepted', 'declined']], ['loop', ['every 5s']], ['par', ['to shopper', 'to warehouse']],
      ['critical', ['charge', 'timeout']], ['opt', ['gift wrap']], ['break', ['out of stock']], ['region', [null]],
    ]);
    const region = data.steps.find((s) => s.kind === 'fragment' && s.type === 'region');
    expect(region).toMatchObject({ colors: { fill: 'rgb(200, 220, 255)' } });
  });

  it('reads notes, create, and destroy', () => {
    const notes = data.steps.flatMap((s) => (s.kind === 'note' ? [s] : []));
    expect(notes.at(-1)).toMatchObject({ over: ['U'], side: 'left', text: 'two\nlines' });
    expect(data.steps).toContainEqual({ kind: 'create', participant: 'L' });
    expect(data.steps).toContainEqual({ kind: 'destroy', participant: 'L' });
  });

  it('names a participant a message mentions first, in order', () => {
    expect(dataOf('sequenceDiagram\nB->>A: hi\nNote over C: x').participants.map((p) => p.id)).toEqual(['B', 'A', 'C']);
  });

  it('sizes the page to hold the layout', () => {
    expect(page.width).toBeGreaterThan(400);
    expect(page.height).toBeGreaterThan(400);
  });

  it('warns about what it drops', () => {
    const { warnings } = readMermaidSequence('%%{init: {}}%%\nsequenceDiagram\naccTitle: t\nautonumber 1 5\nlink A: Docs @ https://x\nA->>B: x');
    expect(warnings).toEqual(expect.arrayContaining([
      'Mermaid configuration directives were dropped.', 'Accessibility titles and descriptions were dropped.',
      'Autonumber steps other than 1 were dropped; messages count up by one.', 'Participant menus (links, properties, details) were dropped.',
    ]));
  });

  it('throws naming the line on what it cannot read', () => {
    expect(() => readMermaidSequence('sequenceDiagram\nA->>B: x\nwhat is this')).toThrow(/line 3/);
    expect(() => readMermaidSequence('sequenceDiagram\nend')).toThrow(/line 2: "end" closes nothing/);
    expect(() => readMermaidSequence('sequenceDiagram\nloop x\nelse y\nend')).toThrow(/line 3: "else" is not inside an alt/);
    expect(() => readMermaidSequence('sequenceDiagram\nA->>B: x\nalt y\nA->>B: z')).toThrow(/line 3: this alt is never closed/);
  });

  it('is what the Mermaid format reads a sequenceDiagram as', async () => {
    const read = await DIAGRAM_MERMAID.read!(CHECKOUT);
    expect(read.document.pages[0]!.kind).toBe('sequence');
    expect(DIAGRAM_MERMAID.kinds).toContain('sequence');
  });
});
