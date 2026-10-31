import { describe, expect, it } from 'vitest';
import type { DiagramData } from '@weasel-js/diagram';
import type { DiagramDocument, GraphPage } from '../document';
import { documentFromScene } from '../fromScene';
import { docScene } from '../testing/docScene';
import { readMermaid } from './read';
import { writeMermaid } from './write';
import { asGraph } from '../testing/graphPages';

const pageOf = (data: DiagramData, extra: Partial<Omit<GraphPage, 'kind'>> = {}): DiagramDocument =>
  ({ pages: [{ kind: 'graph', id: 'p', width: 400, height: 300, data, ...extra }], theme: 'paper' });
const back = (doc: DiagramDocument, page?: string) => readMermaid(writeMermaid(doc, page !== undefined ? { page } : {}).text).document.pages.map(asGraph)[0]!;
const topology = (data: DiagramData) => data.edges.map((e) => [e.from, e.to, e.label]);
const shapes = (data: DiagramData) => Object.fromEntries(data.nodes.map((n) => [n.id, [n.outline ?? 'rect', n.lines]]));

const FLOW: DiagramData = {
  nodes: [
    { id: 'a', lines: ['Start'], outline: 'stadium' },
    { id: 'b', lines: ['Is it', '"done"? #1 <b>'], outline: 'diamond' },
    { id: 'c', lines: ['Round [x] (y) {z} |p|'], outline: 'ellipse' },
    { id: 'd', lines: ['Hex'], outline: 'hexagon' },
    { id: 'e', lines: ['Lean'], outline: 'parallelogram' },
    { id: 'f', lines: ['Trap'], outline: 'trapezoid' },
    { id: 'g', lines: ['Plain'] },
  ],
  edges: [
    { from: 'a', to: 'b', label: 'go | "now"' },
    { from: 'b', to: 'c', label: 'yes' },
    { from: 'b', to: 'g' },
    { from: 'c', to: 'd' }, { from: 'd', to: 'e' }, { from: 'e', to: 'f' },
  ],
  containers: [
    { id: 'outer', role: 'container', label: 'Outer box', members: ['c', 'inner'] },
    { id: 'inner', role: 'container', label: 'Inner', members: ['d'] },
  ],
};

describe('writing Mermaid', () => {
  it('reads back the same topology, labels, shapes, and containers', () => {
    const p = back(pageOf(FLOW));
    expect(topology(p.data)).toEqual(topology(FLOW));
    expect(shapes(p.data)).toEqual(shapes(FLOW));
    expect(p.data.containers?.map((c) => [c.id, c.label, c.members])).toEqual([['outer', 'Outer box', ['c', 'inner']], ['inner', 'Inner', ['d']]]);
  });

  it('writes a flowchart titled for its page, running the way the page does', () => {
    const doc = pageOf(FLOW, { name: 'My: flow', direction: 'right' });
    expect(writeMermaid(doc).text).toMatch(/^---\ntitle: "My: flow"\n---\nflowchart LR\n/);
    expect(back(doc)).toMatchObject({ name: 'My: flow', direction: 'right' });
    expect(writeMermaid(pageOf(FLOW)).text).toMatch(/^flowchart TD\n/);
  });

  it('renames ids Mermaid cannot read, keeping their text', () => {
    const data: DiagramData = {
      nodes: [{ id: 'end', lines: ['End'] }, { id: 'two words' }, { id: 'two_words' }, { id: 'x-->y' }],
      edges: [{ from: 'end', to: 'two words' }, { from: 'two words', to: 'x-->y' }],
    };
    const p = back(pageOf(data));
    expect(p.data.nodes.map((n) => [n.id, n.lines])).toEqual([
      ['end_', ['End']], ['two_words_2', []], ['two_words', []], ['x_y', []],
    ]);
    expect(topology(p.data)).toEqual([['end_', 'two_words_2', undefined], ['two_words_2', 'x_y', undefined]]);
  });

  it('writes the theme\'s colors as the default class and each item\'s own over them', () => {
    const data: DiagramData = {
      nodes: [{ id: 'a', lines: ['A'], colors: { fill: 'rgba(255, 0, 0, 0.5)' } }, { id: 'b', lines: ['B'], colors: { fill: 'rgba(255, 0, 0, 0.5)' } }, { id: 'c' }],
      edges: [{ from: 'a', to: 'b', colors: { stroke: '#00ff00' } }, { from: 'b', to: 'c' }],
      containers: [{ id: 'k', role: 'container', members: ['c'], colors: { stroke: '#0000ff' } }],
    };
    const { text } = writeMermaid(pageOf(data));
    expect(text).toMatch(/classDef default fill:#[0-9a-f]+,stroke:#[0-9a-f]+,color:#[0-9a-f]+\n/);
    expect(text).toMatch(/classDef s1 fill:#ff000080\n {2}class a,b s1\n/);
    const p = back(pageOf(data));
    expect(p.data.nodes[0]!.colors?.fill).toBe('#ff000080');
    expect(p.data.edges[0]!.colors?.stroke).toBe('#00ff00');
    expect(p.data.containers![0]!.colors?.stroke).toBe('#0000ff');
  });

  it('writes link strokes and heads', () => {
    const data: DiagramData = {
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [
        { id: '1', from: 'a', to: 'b', colors: { markerEnd: null } },
        { id: '2', from: 'a', to: 'b', colors: { markerStart: 'circle', markerEnd: 'circle' } },
        { id: '3', from: 'a', to: 'b', colors: { markerStart: 'arrow' } },
        { id: '4', from: 'a', to: 'b', colors: { dash: [4, 4] } },
        { id: '5', from: 'a', to: 'b', colors: { width: 3 } },
      ],
    };
    expect(writeMermaid(pageOf(data)).text).toMatch(/a --- b\n {2}a o--o b\n {2}a <--> b\n {2}a -.-> b\n {2}a ==> b\n/);
    const strokes = (e: DiagramData['edges'][number]) =>
      [e.colors?.markerStart, e.colors?.markerEnd, e.colors?.dash !== undefined, (e.colors?.width ?? 0) >= 3];
    expect(back(pageOf(data)).data.edges.map(strokes)).toEqual(data.edges.map(strokes));
  });

  it('writes the page in view, and warns for what Mermaid cannot hold', () => {
    const doc = documentFromScene(docScene());
    const { warnings } = writeMermaid(doc, { page: 'p2' });
    expect(back(doc, 'p2').data.containers?.map((c) => [c.id, c.members])).toEqual([['p', ['l1', 'l2']], ['l1', ['d']], ['l2', undefined]]);
    expect(warnings).toEqual([
      'Mermaid has no pools or lanes; they were written as nested subgraphs.',
      'Mermaid holds one page; connectors to other pages were dropped.',
      'Mermaid holds no positions; the page is laid out again when read.',
    ]);
  });

  it('warns for ports and for ends Mermaid cannot draw', () => {
    const data: DiagramData = {
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b', fromPort: 'e' }, { from: 'a', to: 'b', colors: { markerStart: 'circle' } }],
    };
    expect(writeMermaid(pageOf(data)).warnings).toEqual([
      'Mermaid has no ports; connectors\' ports were dropped.',
      'Mermaid draws a link\'s two heads alike; some ends were changed.',
    ]);
  });

  it('writes a cylinder, a double ellipse, and a rounded rect in brackets, and an outline it has none for as a rectangle', () => {
    const data: DiagramData = {
      nodes: [
        { id: 'a', lines: ['Store'], outline: 'cylinder' },
        { id: 'b', lines: ['Event'], outline: 'doubleEllipse' },
        { id: 'c', lines: ['Fold'], outline: 'note' },
        { id: 'd', lines: ['Round'], outline: 'roundRect' },
      ],
      edges: [],
    };
    const { text, warnings } = writeMermaid(pageOf(data));
    expect(shapes(readMermaid(text).document.pages.map(asGraph)[0]!.data)).toEqual({
      a: ['cylinder', ['Store']], b: ['doubleEllipse', ['Event']], c: ['rect', ['Fold']], d: ['roundRect', ['Round']],
    });
    expect(warnings).toContain('Mermaid has no bracket shape for some outlines; they were written as rectangles.');
  });

  it('writes BPMN figures as the nearest bracket shape, and says what they lost', () => {
    const data: DiagramData = {
      nodes: [
        { id: 'a', lines: ['Start'], outline: 'event' },
        { id: 'b', lines: ['Wait'], outline: 'intermediateEvent' },
        { id: 'c', lines: ['Which'], outline: 'exclusiveGateway' },
        { id: 'd', lines: ['Sub'], outline: 'subprocess' },
      ],
      edges: [],
    };
    const { text, warnings } = writeMermaid(pageOf(data));
    expect(shapes(readMermaid(text).document.pages.map(asGraph)[0]!.data)).toEqual({
      a: ['ellipse', ['Start']], b: ['doubleEllipse', ['Wait']], c: ['diamond', ['Which']], d: ['roundRect', ['Sub']],
    });
    expect(warnings).toEqual([expect.stringMatching(/^Mermaid has no BPMN figures; .*gateways as diamonds without their markers/)]);
  });
});
