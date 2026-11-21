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

describe('draw-style XML rounded boxes', () => {
  it('reads an absoluteArcSize arc in pixels against the box', async () => {
    const { data } = await readCells(
      vertex('wide', 'rounded=1;absoluteArcSize=1;arcSize=50;', 'width="200" height="150"')
      + vertex('flat', 'rounded=1;absoluteArcSize=1;arcSize=40;', 'y="200" width="200" height="40"'),
    );
    expect(node(data, 'wide').outline).toBe('roundRect');
    expect(node(data, 'flat').outline).toBe('stadium');
  });

  it('warns of an unknown shape it draws as a rounded rect', async () => {
    const { data, warnings } = await readCells(vertex('s', 'shape=step;rounded=1;', 'width="100" height="40"'));
    expect(node(data, 's').outline).toBe('roundRect');
    expect(warnings).toContain('Shapes of kind "step" were drawn as rounded rects.');
  });
});

describe('draw-style XML pools and containers', () => {
  it('keeps a container holding one tall container a container', async () => {
    const { data } = await roundTrip({
      nodes: [{ id: 'n', lines: ['N'], at: { x: 60, y: 100 }, width: 80, height: 40 }],
      edges: [],
      containers: [
        { id: 'outer', role: 'container', label: 'Outer', members: ['inner'] },
        { id: 'inner', role: 'container', label: 'Inner', members: ['n'], box: { x: 40, y: 60, width: 200, height: 800 } },
      ],
    });
    expect(region(data, 'outer').role).toBe('container');
    expect(region(data, 'inner').role).toBe('container');
  });

  it('keeps a pool with no lanes a pool', async () => {
    const { data } = await roundTrip({
      nodes: [], edges: [],
      containers: [{ id: 'pool', role: 'pool', label: 'Pool', axis: 'y', box: { x: 20, y: 20, width: 400, height: 200 }, lanes: [] }],
    });
    expect(region(data, 'pool').role).toBe('pool');
  });
});

describe('draw-style XML clusters', () => {
  it('leaves members a later cluster also names in the earlier one', async () => {
    const { data } = await roundTrip({
      nodes: [...TWO, { id: 'c', lines: ['C'], at: { x: 0, y: 200 }, width: 80, height: 40 }],
      edges: [],
      clusters: [{ id: 'A', members: ['a', 'b', 'c'] }, { id: 'B', members: ['a', 'b'] }],
    });
    expect(data.clusters?.find((g) => g.id === 'A')?.members).toEqual(['a', 'b', 'c']);
    expect(data.clusters?.some((g) => g.members.includes('B'))).toBe(false);
  });
});

describe('draw-style XML routers', () => {
  it('warns that an obstacle-avoiding connector is written orthogonal', () => {
    const { warnings } = DIAGRAM_DRAW_XML.write!(doc({ nodes: TWO, edges: [{ id: 'e', from: 'a', to: 'b', router: 'avoid' }] }), { theme: THEME });
    expect(warnings).toContain('Connectors routed around shapes were written as orthogonal connectors.');
  });
});

describe('draw-style XML self-loop labels', () => {
  it('keeps a dragged label on a self-loop where it was dragged', async () => {
    const { data } = await readCells(vertex('a', 'rounded=0;', 'x="100" y="100" width="80" height="40"')
      + '<mxCell id="e" value="loop" edge="1" parent="1" source="a" target="a" style=""><mxGeometry relative="1" as="geometry">'
      + '<mxPoint x="40" y="-30" as="offset"/></mxGeometry></mxCell>');
    expect(edge(data, 'e').labelPlacement).toEqual({ at: { near: { x: 180, y: 90 } } });
  });
});

describe('draw-style XML file names', () => {
  it('claims the draw app\'s .drawio files, and writes one', () => {
    expect(DIAGRAM_DRAW_XML.extensions).toEqual(['.drawio', '.xml']);
  });
});

describe('draw-style XML fonts', () => {
  const style = (text: string) => text.match(/value="(?:T|H)"[^>]*style="([^"]*)"/)?.[1] ?? '';

  it('writes a heavy weight as bold and a regular one as not', () => {
    const write = (s: object) => DIAGRAM_DRAW_XML.write!(doc({
      nodes: [{ id: 'n', at: { x: 0, y: 0 }, rows: [{ kind: 'label', text: 'T', style: s }] }], edges: [],
    }), { theme: THEME }).text;
    expect(style(write({ weight: 700 }))).toContain('fontStyle=1;');
    expect(style(write({ bold: true, weight: 400 }))).not.toContain('fontStyle');
  });

  it('writes a header row\'s font', () => {
    const { text } = DIAGRAM_DRAW_XML.write!(doc({
      nodes: [{ id: 'n', at: { x: 0, y: 0 }, rows: [{ kind: 'header', text: 'H', style: { fontSize: 16, bold: true } }] }], edges: [],
    }), { theme: THEME });
    expect(style(text)).toContain('fontSize=16;');
    expect(style(text)).toContain('fontStyle=1;');
  });

  it('warns when rows styled differently share the first one\'s font', () => {
    const { warnings } = DIAGRAM_DRAW_XML.write!(doc({
      nodes: [{ id: 'n', at: { x: 0, y: 0 }, rows: [
        { kind: 'label', text: 'T', style: { fontSize: 16 } }, { kind: 'label', text: 'U', style: { fontSize: 10 } },
      ] }], edges: [],
    }), { theme: THEME });
    expect(warnings).toContain('Text rows styled apart within one shape were written in its first row\'s style.');
  });
});
