import { describe, expect, it } from 'vitest';
import type { DataNode } from '@weasel-js/diagram';
import type { DiagramDocument } from './document';
import { writeDot } from './dot/write';
import { DIAGRAM_DRAW_XML } from './drawXml/format';
import { writeFlowchart } from './mermaid/flowchart/write';

const CLASS: DataNode = {
  id: 'c',
  rows: [{ kind: 'label', text: 'Order' }, { kind: 'divider' }, { kind: 'field', label: 'id', value: 'int' }, { kind: 'divider', inset: 4 }],
};
const doc: DiagramDocument = { pages: [{ kind: 'graph', id: 'p', width: 400, height: 300, data: { nodes: [CLASS], edges: [] } }], theme: 'paper' };

describe('a shape with divider rows, written to a text format', () => {
  it.each([
    ['DOT', () => writeDot(doc)],
    ['Mermaid', () => writeFlowchart(doc)],
    ['draw-style XML', () => DIAGRAM_DRAW_XML.write!(doc)],
  ])('keeps its text and drops its dividers without a warning in %s', (_name, write) => {
    const { text, warnings } = write();
    expect(text).toContain('Order');
    expect(text).toContain('id: int');
    expect(warnings).toEqual([]);
  });
});

describe('a shape with a header row, written to a text format', () => {
  const HEADED: DataNode = {
    id: 'h',
    rows: [{ kind: 'header', text: 'Order', aside: '«entity»' }, { kind: 'field', label: 'id', value: 'int' }],
  };
  const headed: DiagramDocument = { ...doc, pages: [{ kind: 'graph', id: 'p', width: 400, height: 300, data: { nodes: [HEADED], edges: [] } }] };
  it.each([
    ['DOT', () => writeDot(headed)],
    ['Mermaid', () => writeFlowchart(headed)],
    ['draw-style XML', () => DIAGRAM_DRAW_XML.write!(headed)],
  ])('keeps the header text and its aside without a warning in %s', (_name, write) => {
    const { text, warnings } = write();
    expect(text).toContain('Order');
    expect(text).toContain('«entity»');
    expect(text).toContain('id: int');
    expect(warnings).toEqual([]);
  });
});
