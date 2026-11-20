import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataNode } from '@weasel-js/diagram';
import { onlyPage, sortedPage } from '../../testing/samePage';
import { parseRequirementDiagram } from './parse';
import { readRequirementDiagram } from './read';
import { writeRequirementDiagram } from './write';

const BRAKES = readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'requirement', 'brakes.mmd'), 'utf8');
const page = (text: string) => onlyPage(readRequirementDiagram(text).document);
const node = (text: string, id: string) => page(text).data.nodes.find((n) => n.id === id) as DataNode;

describe('reading a Mermaid requirement diagram', () => {
  it('reads a page of notation requirement', () => {
    expect(page(BRAKES)).toMatchObject({ name: 'Brake requirements', notation: 'requirement' });
  });

  it('reads a block as its kind and name, a divider, and a field per field', () => {
    expect(node(BRAKES, 'abs').rows).toEqual([
      { kind: 'label', text: '<<functionalRequirement>>' }, { kind: 'label', text: 'abs' }, { kind: 'divider' },
      { kind: 'field', label: 'id', value: '1.1' }, { kind: 'field', label: 'text', value: 'Wheels never lock under braking.' },
      { kind: 'field', label: 'risk', value: 'medium' }, { kind: 'field', label: 'verifymethod', value: 'test' },
    ]);
    expect(node(BRAKES, 'fluid type').rows!.slice(0, 2)).toEqual([{ kind: 'label', text: '<<designConstraint>>' }, { kind: 'label', text: 'fluid type' }]);
    expect(node(BRAKES, 'brake_ecu').rows![0]).toEqual({ kind: 'label', text: '<<element>>' });
  });

  it('reads relationships as dashed arrows labeled with their kind, a backward one turned around', () => {
    const { edges } = page(BRAKES).data;
    expect(edges.find((e) => e.from === 'brake_ecu')).toMatchObject({ to: 'abs', label: '<<satisfies>>', colors: { dash: [4, 4] } });
    expect(edges.find((e) => e.label === '<<refines>>')).toMatchObject({ from: 'fluid type', to: 'weight' });
    expect(readRequirementDiagram(BRAKES).warnings).toEqual([]);
  });

  it('names the line it cannot read', () => {
    expect(() => parseRequirementDiagram('requirementDiagram\nrequirement r {\nid 1\n}')).toThrow(/^Mermaid, line 3: cannot read "id 1" as a field/);
    expect(() => parseRequirementDiagram('requirementDiagram\nrequirement r {\nid: 1')).toThrow('Mermaid, line 2: requirement r is never closed');
    expect(() => parseRequirementDiagram('requirementDiagram\na - likes -> b')).toThrow(/^Mermaid, line 2: cannot read/);
  });
});

describe('writing a Mermaid requirement diagram', () => {
  it('round-trips the fixture: text to page to text to page', () => {
    const first = page(BRAKES);
    const text = writeRequirementDiagram({ pages: [first] }).text;
    expect(sortedPage(page(text))).toEqual(sortedPage(first));
    expect(writeRequirementDiagram({ pages: [page(text)] }).text).toBe(text);
  });

  it('writes blocks with their fields, names that are not one word quoted', () => {
    const text = writeRequirementDiagram({ pages: [page(BRAKES)] }).text;
    expect(text).toContain('  designConstraint "fluid type" {\n    id: 4\n');
    expect(text).toContain('  "fluid type" - refines -> weight');
  });

  it('writes a plain box as a requirement and an unlabeled edge as traces, with warnings', () => {
    const { text, warnings } = writeRequirementDiagram({ pages: [{
      kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }] },
    }] });
    expect(text).toContain('  requirement a {\n  }\n');
    expect(text).toContain('  a - traces -> b');
    expect(warnings).toContain('Mermaid relationships are one of seven kinds, named in their label; others were written as traces.');
  });

  it('writes a field name of several words as one, with a warning, so the text reads back', () => {
    const { text, warnings } = writeRequirementDiagram({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: {
      nodes: [{ id: 'r', rows: [{ kind: 'label', text: 'R' }, { kind: 'divider' }, { kind: 'field', label: 'risk level', value: 'high' }] }], edges: [],
    } }] });
    expect(page(text).data.nodes[0]!.rows).toContainEqual({ kind: 'field', label: 'risk_level', value: 'high' });
    expect(warnings).toContain('Mermaid requirement field names are one word; other characters in them were written as underscores.');
  });

  it('keeps a field value\'s quotes and its spaces at either end', () => {
    for (const value of ['"x"', ' x ']) {
      const text = writeRequirementDiagram({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: {
        nodes: [{ id: 'r', rows: [{ kind: 'label', text: 'R' }, { kind: 'divider' }, { kind: 'field', label: 'text', value }] }], edges: [],
      } }] }).text;
      expect(page(text).data.nodes[0]!.rows).toContainEqual({ kind: 'field', label: 'text', value });
    }
  });

  const graph = (nodes: object[], edges: object[] = []) => ({ pages: [{ kind: 'graph' as const, id: 'p', width: 100, height: 100, data: { nodes, edges } as never }] });

  it('writes a name\'s double quotes as single ones before making names distinct, with a warning, so two blocks stay two', () => {
    const { text, warnings } = writeRequirementDiagram(graph([{ id: 'a', lines: ['say "hi"'] }, { id: 'b', lines: ["say 'hi'"] }], [{ from: 'a', to: 'b' }]));
    expect(page(text).data.nodes.map((n) => n.id)).toEqual(["say 'hi'", "say 'hi' 2"]);
    expect(page(text).data.edges.map((e) => [e.from, e.to])).toEqual([["say 'hi'", "say 'hi' 2"]]);
    expect(warnings).toContain('Mermaid requirement names hold no double quotes; they were written as single ones.');
  });

  it('warns of colors on a block whose name is not one word, which a style cannot name', () => {
    const { text, warnings } = writeRequirementDiagram(graph([{ id: 'a', lines: ['Login page'], colors: { fill: '#f00' } }]));
    expect(text).not.toContain('style');
    expect(warnings).toEqual(['Mermaid styles name a block by one word; colors on blocks with longer names were dropped.']);
  });

  it('warns of text rows before the divider past the name, and of rows other than text and fields', () => {
    const { warnings } = writeRequirementDiagram(graph([
      { id: 'a', lines: ['Login', 'must lock after 3 tries'] },
      { id: 'b', rows: [{ kind: 'label', text: 'B' }, { kind: 'slot', height: 10 }] },
    ]));
    expect(warnings).toEqual([
      'Mermaid requirements hold a name and named fields; text rows before the divider past the name were dropped.',
      'Mermaid requirements hold text and fields only; other rows were dropped.',
    ]);
  });
});
