import { describe, expect, it } from 'vitest';
import { DIAGRAM_THEMES, type DataContainer, type DataEdge, type DataNode, type DiagramData } from '@weasel-js/diagram';
import type { DiagramDocument } from '../document';
import { DIAGRAM_DRAW_XML } from './format';
import { asGraph } from '../testing/asGraph';

const THEME = DIAGRAM_THEMES.paper!;

const xml = (cells: string): string =>
  `<mxfile><diagram id="p" name="P"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel></diagram></mxfile>`;

async function readCells(cells: string) {
  const { document, warnings } = await Promise.resolve(DIAGRAM_DRAW_XML.read!(xml(cells)));
  return { data: asGraph(document.pages[0]!).data, warnings };
}

const vertex = (id: string, style: string, box: string, value = id, parent = '1'): string =>
  `<mxCell id="${id}" value="${value}" style="${style}" vertex="1" parent="${parent}"><mxGeometry ${box} as="geometry"/></mxCell>`;

const node = (data: DiagramData, id: string): DataNode => data.nodes.find((n) => n.id === id)!;
const edge = (data: DiagramData, id: string): DataEdge => data.edges.find((e) => e.id === id)!;
const region = (data: DiagramData, id: string): DataContainer => data.containers!.find((c) => c.id === id)!;

const doc = (data: DiagramData): DiagramDocument => ({ pages: [{ kind: 'graph', id: 'p', width: 800, height: 600, data }] });

async function roundTrip(data: DiagramData) {
  const written = DIAGRAM_DRAW_XML.write!(doc(data), { theme: THEME });
  const read = await Promise.resolve(DIAGRAM_DRAW_XML.read!(written.text));
  return { text: written.text, writeWarnings: written.warnings, data: asGraph(read.document.pages[0]!).data };
}

const TWO = [
  { id: 'a', lines: ['A'], at: { x: 0, y: 0 }, width: 80, height: 40 },
  { id: 'b', lines: ['B'], at: { x: 300, y: 0 }, width: 80, height: 40 },
];

describe('draw-style XML bar markers', () => {
  it('writes a bar as the perpendicular ERone and reads it back as a bar', async () => {
    const { text, data } = await roundTrip({ nodes: TWO, edges: [{ id: 'e', from: 'a', to: 'b', colors: { markerEnd: 'bar' } }] });
    expect(text).toContain('endArrow=ERone;');
    expect(edge(data, 'e').colors?.markerEnd).toBe('bar');
  });

  it('warns that a dash, a slash across the line, is drawn as a bar', async () => {
    const { data, warnings } = await readCells(`${vertex('a', 'rounded=0;', 'width="80" height="40"')}${vertex('b', 'rounded=0;', 'x="300" width="80" height="40"')}`
      + '<mxCell id="e" edge="1" parent="1" source="a" target="b" style="endArrow=dash;"><mxGeometry relative="1" as="geometry"/></mxCell>');
    expect(edge(data, 'e').colors?.markerEnd).toBe('bar');
    expect(warnings).toContain('Arrowheads of kind "dash" were drawn as bars.');
  });
});
