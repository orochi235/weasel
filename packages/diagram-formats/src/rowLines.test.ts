import { describe, expect, it } from 'vitest';
import type { DataNode } from '@weasel-js/diagram';
import type { DiagramDocument } from './document';
import { writeDot } from './dot/write';
import { DRAW_XML } from './drawXml/format';
import { writeMermaid } from './mermaid/write';

const CLASS: DataNode = {
  id: 'c',
  rows: [{ kind: 'label', text: 'Order' }, { kind: 'divider' }, { kind: 'field', label: 'id', value: 'int' }, { kind: 'divider', inset: 4 }],
};
const doc: DiagramDocument = { pages: [{ id: 'p', width: 400, height: 300, data: { nodes: [CLASS], edges: [] } }], theme: 'paper' };

describe('a shape with divider rows, written to a text format', () => {
  it.each([
    ['DOT', () => writeDot(doc)],
    ['Mermaid', () => writeMermaid(doc)],
    ['draw-style XML', () => DRAW_XML.write!(doc)],
  ])('keeps its text and drops its dividers without a warning in %s', (_name, write) => {
    const { text, warnings } = write();
    expect(text).toContain('Order');
    expect(text).toContain('id: int');
    expect(warnings).toEqual([]);
  });
});
