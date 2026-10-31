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
});
