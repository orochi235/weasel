import { describe, expect, it } from 'vitest';
import type { DataNode, DiagramData } from '@weasel-js/diagram';
import type { DiagramDocument, DocumentPage } from '../document';
import { documentFromScene } from '../fromScene';
import { docScene } from '../testing/docScene';
import { readDot } from './read';
import { writeDot } from './write';

const pageOf = (data: DiagramData, extra: Partial<DocumentPage> = {}): DiagramDocument =>
  ({ pages: [{ id: 'p', width: 400, height: 300, data, ...extra }], theme: 'paper' });
const back = (doc: DiagramDocument, page?: string) => readDot(writeDot(doc, page !== undefined ? { page } : {}).text).document.pages[0]!;
const topology = (data: DiagramData) => data.edges.map((e) => [e.from, e.to, e.label]);
const shapes = (data: DiagramData) => Object.fromEntries(data.nodes.map((n) => [n.id, [n.outline ?? 'rect', n.lines]]));

const FLOW: DiagramData = {
  nodes: [
    { id: 'a', lines: ['Start'], outline: 'stadium' },
    { id: 'b', lines: ['Is it', '"done"?'], outline: 'diamond' },
    { id: 'c', lines: ['Back\\slash'], outline: 'ellipse' },
    { id: 'd', lines: ['Hex'], outline: 'hexagon' },
    { id: 'e', lines: ['Lean'], outline: 'parallelogram' },
    { id: 'f', lines: ['Trap'], outline: 'trapezoid' },
    { id: 'node', lines: ['Keyword'] },
    { id: 'two words', lines: ['Spaced'] },
  ],
  edges: [
    { from: 'a', to: 'b', label: 'go' },
    { from: 'b', to: 'c', label: 'yes', fromPort: 's', toPort: 'n' },
    { from: 'b', to: 'node' },
    { from: 'node', to: 'two words' },
    { from: 'c', to: 'd' }, { from: 'd', to: 'e' }, { from: 'e', to: 'f' },
  ],
  containers: [
    { id: 'outer', role: 'container', label: 'Outer', members: ['c', 'inner'] },
    { id: 'inner', role: 'container', label: 'Inner', members: ['d'] },
  ],
};

describe('writing DOT', () => {
  it('reads back the same topology, labels, shapes, ports, and containers', () => {
    const p = back(pageOf(FLOW));
    expect(topology(p.data)).toEqual(topology(FLOW));
    expect(shapes(p.data)).toEqual(shapes(FLOW));
    expect(p.data.edges[1]).toMatchObject({ fromPort: 's', toPort: 'n' });
    expect(p.data.containers?.map((c) => [c.id, c.label, c.members])).toEqual([['outer', 'Outer', ['c', 'inner']], ['inner', 'Inner', ['d']]]);
  });

  it('writes a digraph named for its page, running the way the page does', () => {
    const { text } = writeDot(pageOf(FLOW, { name: 'My flow', direction: 'left' }));
    expect(text).toMatch(/^digraph "My flow" \{\n {2}rankdir=RL;/);
    expect(back(pageOf(FLOW, { name: 'My flow', direction: 'left' }))).toMatchObject({ name: 'My flow', direction: 'left' });
    expect(writeDot(pageOf(FLOW)).text).not.toMatch(/rankdir/);
  });

  it('writes the theme\'s colors as defaults and each item\'s own over them', () => {
    const data: DiagramData = {
      nodes: [{ id: 'a', lines: ['A'], colors: { fill: '#ff0000' } }, { id: 'b', lines: ['B'], style: 'accent' }],
      edges: [{ from: 'a', to: 'b', colors: { stroke: '#00ff00', dash: [6, 4] } }],
    };
    const { text } = writeDot(pageOf(data));
    expect(text).toMatch(/node \[shape=box, style=filled, fillcolor="#[0-9a-f]+", color="#[0-9a-f]+", fontcolor="#[0-9a-f]+"\]/);
    const p = back(pageOf(data));
    expect(p.data.nodes[0]!.colors?.fill).toBe('#ff0000');
    expect(p.data.edges[0]!.colors).toMatchObject({ stroke: '#00ff00', dash: [6, 4] });
  });

  it('writes arrowheads and their absence', () => {
    const data: DiagramData = {
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [
        { id: '1', from: 'a', to: 'b', colors: { markerEnd: null } },
        { id: '2', from: 'a', to: 'b', colors: { markerStart: 'circle' } },
        { id: '3', from: 'a', to: 'b', colors: { markerStart: 'arrow', markerEnd: null } },
      ],
    };
    const markers = (e: DiagramData['edges'][number]) => ({ markerStart: e.colors?.markerStart, markerEnd: e.colors?.markerEnd });
    expect(back(pageOf(data)).data.edges.map(markers)).toEqual(data.edges.map(markers));
  });

  it('writes every node\'s place, size, and the page box when all are placed', () => {
    const data: DiagramData = {
      nodes: [{ id: 'a', at: { x: 10, y: 20 }, width: 100, height: 40 }, { id: 'b', at: { x: 200, y: 150 }, width: 80, height: 50 }],
      edges: [],
    };
    const p = back(pageOf(data));
    expect(p).toMatchObject({ width: 400, height: 300 });
    expect(p.data.nodes.map((n: DataNode) => [n.at, n.width, n.height])).toEqual(data.nodes.map((n) => [n.at, n.width, n.height]));
  });

  it('writes the page in view, and warns for what DOT cannot hold', () => {
    const doc = documentFromScene(docScene());
    const { text, warnings } = writeDot(doc, { page: 'p2' });
    expect(text).toMatch(/subgraph cluster_p \{[\s\S]*subgraph cluster_l1 \{[\s\S]*"?d"? \[/);
    expect(back(doc, 'p2').data.containers?.map((c) => [c.id, c.members])).toEqual([['p', ['l1', 'l2']], ['l1', ['d']], ['l2', undefined]]);
    expect(warnings).toEqual([
      'DOT has no pools or lanes; they were written as nested clusters.',
      'DOT holds one page; connectors to other pages were dropped.',
    ]);
    expect(writeDot(doc).warnings).toEqual([
      'DOT holds one page; connectors to other pages were dropped.',
      'DOT holds no routes; connectors\' bends were dropped.',
    ]);
  });

  it('warns for groups, drawn outlines, ports DOT has no name for, and connectors to containers', () => {
    const data: DiagramData = {
      nodes: [{ id: 'a', ports: [{ id: 'out', at: { u: 1, v: 0.5 } }] }, { id: 'b', outline: { commands: [] } as never }],
      edges: [{ from: 'a', to: 'b', fromPort: 'out' }, { from: 'a', to: 'k' }],
      groups: [{ id: 'g', members: ['a'] }],
      containers: [{ id: 'k', role: 'container', members: ['b'] }],
    };
    expect(writeDot(pageOf(data)).warnings).toEqual([
      'DOT has no groups; they were written as clusters, which read back as containers.',
      'DOT has no drawn outlines; those shapes were written as rectangles.',
      'DOT has only compass ports; connectors\' other ports were dropped.',
      'DOT joins nodes only; connectors to containers and groups were dropped.',
    ]);
  });

  it('writes the outlines DOT has a shape for, and the rest as boxes with a warning', () => {
    const data: DiagramData = {
      nodes: (['cylinder', 'note', 'folder', 'octagon', 'triangle', 'cube', 'doubleEllipse', 'document'] as const)
        .map((outline) => ({ id: outline, lines: [outline], outline })),
      edges: [],
    };
    const { text, warnings } = writeDot(pageOf(data));
    expect(Object.fromEntries(readDot(text).document.pages[0]!.data.nodes.map((n) => [n.id, n.outline ?? 'rect']))).toEqual({
      cylinder: 'cylinder', note: 'note', folder: 'folder', octagon: 'octagon', triangle: 'triangle', cube: 'cube',
      doubleEllipse: 'doubleEllipse', document: 'document',
    });
    expect(warnings).toContain('DOT has no shape for some outlines; they were written as boxes.');
  });

  it('marks a stadium, and an outline DOT has no shape for, so both come back while Graphviz draws boxes', () => {
    const data: DiagramData = {
      nodes: (['stadium', 'roundRect', 'server', 'exclusiveGateway'] as const).map((outline) => ({ id: outline, lines: [outline], outline })),
      edges: [],
    };
    const { text } = writeDot(pageOf(data));
    expect(text).toMatch(/"stadium".*style="rounded,filled".*weasel_outline=stadium/);
    expect(text).toMatch(/"server".*weasel_outline=server/);
    expect(text).not.toMatch(/"roundRect".*weasel_outline/);
    expect(Object.fromEntries(readDot(text).document.pages[0]!.data.nodes.map((n) => [n.id, n.outline]))).toEqual({
      stadium: 'stadium', roundRect: 'roundRect', server: 'server', exclusiveGateway: 'exclusiveGateway',
    });
  });

  it('round-trips the crow\'s-foot and hollow-triangle heads', () => {
    const heads = ['triangle-hollow', 'crow-one', 'crow-many', 'crow-zero-one', 'crow-one-many', 'crow-zero-many'] as const;
    const data: DiagramData = {
      nodes: [{ id: 'a', lines: ['A'] }, { id: 'b', lines: ['B'] }],
      edges: heads.map((h) => ({ from: 'a', to: 'b', colors: { markerEnd: h } })),
    };
    expect(back(pageOf(data)).data.edges.map((e) => e.colors?.markerEnd)).toEqual([...heads]);
  });
});
