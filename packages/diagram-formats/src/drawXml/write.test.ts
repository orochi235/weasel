import { describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/core';
import { DIAGRAM_THEMES, dataNodeStyle, type DiagramData } from '@weasel-js/diagram';
import type { DiagramDocument } from '../document';
import { DRAW_XML } from './format';
import { parseStyle, shapeOf } from './style';
import { asGraph } from '../testing/graphPages';

const THEME = DIAGRAM_THEMES.paper!;

const DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: ['A & "B"', '<two>'], outline: 'stadium', at: { x: 20, y: 30 }, width: 100, height: 40 },
    { id: 'd', lines: ['D'], outline: 'diamond', at: { x: 200, y: 30 }, colors: { fill: '#ff0000' } },
    { id: 'm', lines: ['M'], at: { x: 60, y: 200 }, rows: [{ kind: 'label', text: 'M', style: { fontSize: 18, bold: true } }] },
    { id: 't', lines: ['T'], at: { x: 400, y: 30 } },
  ],
  edges: [
    { id: 'ad', from: 'a', to: 'd', router: 'orthogonal', fromPort: 's', waypoints: [{ x: 70, y: 120 }], label: 'go', labelPlacement: { at: 0.25, offset: 6 } },
    { id: 'dt', from: 'd', to: 't', router: 'bezier', colors: { stroke: '#00ff00', markerEnd: null } },
    { id: 'tm', from: 't', to: 'm', router: 'avoid', routed: [{ x: 440, y: 230 }] },
  ],
  containers: [{ id: 'k', role: 'container', label: 'Box', members: ['m'], box: { x: 40, y: 160, width: 200, height: 120 } }],
};

const DOC: DiagramDocument = {
  pages: [
    { kind: 'graph', id: 'p1', width: 600, height: 400, data: DATA },
    { kind: 'graph',
      id: 'p2', name: 'Pools', width: 600, height: 400,
      data: {
        nodes: [{ id: 'x', lines: ['X'], at: { x: 100, y: 60 } }],
        edges: [],
        containers: [{
          id: 'pool', role: 'pool', label: 'Pool', axis: 'y', box: { x: 20, y: 20, width: 400, height: 200 },
          lanes: [{ id: 'l1', label: 'One', members: ['x'] }, { id: 'l2', label: 'Two' }],
        }],
      },
    },
  ],
  crossPageEdges: [{ id: 'ax', from: 'a', to: 'x' }],
  theme: 'paper',
};

const xml = (text: string): Document => new DOMParser().parseFromString(text, 'application/xml');
const cell = (doc: Document, id: string): Element => [...doc.getElementsByTagName('mxCell')].find((c) => c.getAttribute('id') === id)!;
const styleOf = (doc: Document, id: string) => parseStyle(cell(doc, id).getAttribute('style'));
const geometry = (doc: Document, id: string) => {
  const g = cell(doc, id).getElementsByTagName('mxGeometry')[0]!;
  return Object.fromEntries(['x', 'y', 'width', 'height'].map((k) => [k, Number(g.getAttribute(k))]));
};

describe('writing draw-style XML', () => {
  const { text, warnings } = DRAW_XML.write!(DOC);
  const out = xml(text);

  it('writes well-formed XML that it recognizes', () => {
    expect(out.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(DRAW_XML.detect(text)).toBe(true);
  });

  it('writes a diagram per page, named as the app names it, with its size', () => {
    const diagrams = [...out.getElementsByTagName('diagram')];
    expect(diagrams.map((d) => [d.getAttribute('id'), d.getAttribute('name')])).toEqual([['p1', 'Page 1'], ['p2', 'Pools']]);
    const model = diagrams[0]!.getElementsByTagName('mxGraphModel')[0]!;
    expect([model.getAttribute('pageWidth'), model.getAttribute('pageHeight')]).toEqual(['600', '400']);
  });

  it('writes each outline as its shape', () => {
    expect(styleOf(out, 'a').values.get('arcSize')).toBe('50');
    expect(shapeOf(styleOf(out, 'd'))).toBe('rhombus');
    expect(styleOf(out, 't').values.get('rounded')).toBe('0');
  });

  it('spells out every color the theme draws, and its own over it', () => {
    expect(styleOf(out, 'd').values.get('fillColor')).toBe('#ff0000');
    const themed = dataNodeStyle({}, THEME);
    expect(styleOf(out, 't').values.get('fillColor')).toBe(themed.fill);
    expect(styleOf(out, 't').values.get('strokeColor')).toBe(themed.stroke);
    expect(styleOf(out, 't').values.get('fontColor')).toBe(themed.text);
  });

  it('writes text plain, escaped, a line each', () => {
    expect(cell(out, 'a').getAttribute('value')).toBe('A & "B"\n<two>');
    expect(styleOf(out, 'a').values.has('html')).toBe(false);
  });

  it('writes a font a row sets', () => {
    expect(Object.fromEntries(styleOf(out, 'm').values)).toMatchObject({ fontSize: '18', fontStyle: '1' });
  });

  it('nests a container\'s members in it, measured from its corner', () => {
    expect(styleOf(out, 'k').names).toContain('swimlane');
    expect(styleOf(out, 'k').values.get('container')).toBe('1');
    expect(cell(out, 'm').getAttribute('parent')).toBe('k');
    expect(geometry(out, 'm')).toMatchObject({ x: 20, y: 40 });
    expect(geometry(out, 'k')).toEqual({ x: 40, y: 160, width: 200, height: 120 });
  });

  it('writes a pool and its lanes as swimlanes, with its header on the side it is drawn', () => {
    const pool = styleOf(out, 'pool');
    expect(Object.fromEntries(pool.values)).toMatchObject({ horizontal: '0', startSize: '32' });
    expect(cell(out, 'l1').getAttribute('parent')).toBe('pool');
    expect(cell(out, 'x').getAttribute('parent')).toBe('l1');
    expect(geometry(out, 'l2')).toMatchObject({ x: 32, y: 100, height: 100 });
  });

  it('writes routers, ports, waypoints, and labels', () => {
    expect(Object.fromEntries(styleOf(out, 'ad').values)).toMatchObject({ edgeStyle: 'orthogonalEdgeStyle', exitX: '0.5', exitY: '1' });
    expect(styleOf(out, 'dt').values.get('curved')).toBe('1');
    expect(cell(out, 'ad').getAttribute('value')).toBe('go');
    const g = cell(out, 'ad').getElementsByTagName('mxGeometry')[0]!;
    expect([g.getAttribute('x'), g.getAttribute('y')]).toEqual(['-0.5', '6']);
    const points = [...g.getElementsByTagName('mxPoint')].map((p) => [p.getAttribute('x'), p.getAttribute('y')]);
    expect(points).toEqual([['70', '120']]);
  });

  it('writes an avoiding connector as orthogonal along its route', () => {
    expect(styleOf(out, 'tm').values.get('edgeStyle')).toBe('orthogonalEdgeStyle');
    expect(cell(out, 'tm').getElementsByTagName('mxPoint')).toHaveLength(1);
  });

  it('writes an edge\'s stroke and markers', () => {
    expect(Object.fromEntries(styleOf(out, 'dt').values)).toMatchObject({ strokeColor: '#00ff00', endArrow: 'none', startArrow: 'none' });
  });

  it('leaves out connectors between pages, with a warning', () => {
    expect(cell(out, 'ax')).toBeUndefined();
    expect(warnings.some((w) => /between pages/.test(w))).toBe(true);
  });

  it('keeps the root and layer cells clear of the items\' ids', () => {
    const taken: DiagramDocument = { pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id: '1', lines: ['One'], at: { x: 0, y: 0 } }], edges: [] } }] };
    const one = xml(DRAW_XML.write!(taken).text);
    expect(cell(one, '1').getAttribute('vertex')).toBe('1');
    expect(cell(one, '1').getAttribute('parent')).toBe('1-2');
  });
});

describe('writing what the format cannot carry', () => {
  it('warns of outline paths and marks, and writes the shape as a rect', () => {
    const doc: DiagramDocument = {
      pages: [{ kind: 'graph',
        id: 'p', width: 300, height: 200,
        data: {
          nodes: [{
            id: 'odd', lines: ['?'], at: { x: 10, y: 10 },
            outline: pathFromD('M0 0 L1 0 L0 1 Z'), marks: [{ d: 'M0 0 L1 1' }],
          }],
          edges: [],
        },
      }],
    };
    const { text, warnings } = DRAW_XML.write!(doc);
    expect(styleOf(xml(text), 'odd').values.get('rounded')).toBe('0');
    expect(warnings).toEqual(expect.arrayContaining([expect.stringMatching(/outline path/), expect.stringMatching(/Marks/)]));
  });

  it('lays out a page whose nodes have no place, and writes where they went', () => {
    const doc: DiagramDocument = {
      pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [{ id: 'a', lines: ['A'] }, { id: 'b', lines: ['B'] }], edges: [{ from: 'a', to: 'b' }] } }],
    };
    const out = xml(DRAW_XML.write!(doc).text);
    expect(geometry(out, 'a').width).toBeGreaterThan(0);
    expect(geometry(out, 'a').y).not.toBe(geometry(out, 'b').y);
  });

  it('round-trips the storage and figure outlines, and the crow\'s-foot and hollow-triangle heads', async () => {
    const OUTLINES = ['roundRect', 'cylinder', 'document', 'note', 'cloud', 'triangle', 'cube', 'folder', 'actor', 'doubleEllipse'] as const;
    const MARKERS = ['triangle-hollow', 'crow-one', 'crow-many', 'crow-zero-one', 'crow-one-many', 'crow-zero-many'] as const;
    const doc: DiagramDocument = { pages: [{ kind: 'graph', id: 'p', width: 900, height: 200, data: {
      nodes: OUTLINES.map((outline, i) => ({ id: outline, lines: [outline], outline, at: { x: i * 100, y: 0 }, width: 80, height: 60 })),
      edges: MARKERS.map((m, i) => ({ id: m, from: OUTLINES[i]!, to: OUTLINES[i + 1]!, colors: { markerEnd: m } })),
    } }] };
    const back = (await DRAW_XML.read!(DRAW_XML.write!(doc).text)).document.pages.map(asGraph)[0]!.data;
    expect(back.nodes.map((n) => n.outline)).toEqual([...OUTLINES]);
    expect(back.edges.map((e) => e.colors?.markerEnd)).toEqual([...MARKERS]);
  });

  it('round-trips the BPMN and network outlines without a warning, their labels left where they were', async () => {
    const OUTLINES = [
      'event', 'intermediateEvent', 'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventGateway', 'subprocess',
      'server', 'router', 'switch', 'firewall', 'laptop', 'desktop', 'phone', 'printer', 'user',
    ] as const;
    const doc: DiagramDocument = { pages: [{ kind: 'graph', id: 'p', width: 1700, height: 200, data: {
      nodes: OUTLINES.map((outline, i) => ({ id: outline, lines: [outline], outline, at: { x: i * 100, y: 0 }, width: 90, height: 80 })),
      edges: [],
    } }] };
    const written = DRAW_XML.write!(doc);
    expect(written.warnings).toEqual([]);
    const back = (await DRAW_XML.read!(written.text)).document.pages.map(asGraph)[0]!.data;
    expect(back.nodes.map((n) => n.outline)).toEqual([...OUTLINES]);
    expect(back.nodes.filter((n) => n.verticalAlign !== undefined)).toEqual([]);
  });

  it('reads a BPMN figure it has no outline for as the nearest one it has', async () => {
    const cell = (id: string, style: string) =>
      `<mxCell id="${id}" value="${id}" style="${style}" vertex="1" parent="1"><mxGeometry x="0" y="0" width="50" height="50" as="geometry"/></mxCell>`;
    const text = `<mxfile><diagram id="d"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${
      cell('end', 'shape=mxgraph.bpmn.event;outline=end;symbol=terminate;')}${
      cell('complex', 'shape=mxgraph.bpmn.gateway2;gwType=complex;')}${
      cell('task', 'shape=mxgraph.bpmn.task;taskMarker=user;rounded=1;')}</root></mxGraphModel></diagram></mxfile>`;
    const back = (await DRAW_XML.read!(text)).document.pages.map(asGraph)[0]!.data;
    expect(back.nodes.map((n) => [n.id, n.outline])).toEqual([['end', 'event'], ['complex', 'diamond'], ['task', 'roundRect']]);
  });
});
