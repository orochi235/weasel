import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { asGraph } from '../../testing/asGraph';
import type { DataNode, DiagramData } from '@weasel-js/diagram';
import { readFlowchart } from './read';

const FLOW = readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'flowchart', 'flow.mmd'), 'utf8');
const page = (text: string) => readFlowchart(text).document.pages.map(asGraph)[0]!;
const node = (data: DiagramData, id: string) => data.nodes.find((n) => n.id === id) as DataNode;

describe('reading Mermaid', () => {
  it('reads a flowchart to one page named by its title, laid out the way its header says', () => {
    const p = page(FLOW);
    expect(p).toMatchObject({ name: 'Order flow', direction: 'right' });
    expect(p.data.nodes.every((n) => n.at === undefined)).toBe(true);
    expect(page('flowchart BT\nA').direction).toBe('up');
    expect(page('graph TD\nA').direction).toBe('down');
  });

  it('reads each shape of the table, and the rest as rects with a warning', () => {
    const { document, warnings } = readFlowchart(FLOW);
    const outlines = Object.fromEntries(document.pages.map(asGraph)[0]!.data.nodes.map((n) => [n.id, n.outline]));
    expect(outlines).toEqual({
      start: 'stadium', check: 'diamond', pick: 'rect', wait: 'ellipse', pack: 'hexagon', label: 'parallelogram',
      ship: 'trapezoid', done: 'rect', db: 'cylinder',
    });
    expect(warnings.some((w) => w.startsWith('Mermaid shapes read as rectangles'))).toBe(false);
    const meta = readFlowchart('flowchart TD\nA(round) & B@{ shape: diam, label: "Meta" } & C@{ shape: cloud } & D@{ shape: bolt }');
    expect(meta.document.pages.map(asGraph)[0]!.data.nodes.map((n) => [n.outline, n.lines]))
      .toEqual([['roundRect', ['round']], ['diamond', ['Meta']], ['cloud', ['C']], ['rect', ['D']]]);
    expect(meta.warnings).toContain('Mermaid shapes read as rectangles: bolt.');
  });

  it('reads text: quoted, with entities and line breaks, and the id when there is none', () => {
    const p = page(FLOW);
    expect(node(p.data, 'done').lines).toEqual(['Done: "shipped"', 'and billed']);
    expect(node(p.data, 'pick').lines).toEqual(['Pick the order']);
    expect(page('flowchart TD\nA --> B').data.nodes.map((n) => n.lines)).toEqual([['A'], ['B']]);
    expect(node(page('flowchart TD\nA["`**Bold** move`"]').data, 'A').lines).toEqual(['Bold move']);
  });

  it('reads edges: chains, & groups, labels both ways, and strokes', () => {
    const p = page(FLOW);
    expect(p.data.edges.map((e) => [e.from, e.to, e.label])).toEqual([
      ['start', 'check', undefined], ['check', 'pick', 'Yes'], ['check', 'wait', 'No'], ['wait', 'check', undefined],
      ['pick', 'pack', undefined], ['pick', 'label', undefined], ['label', 'ship', undefined], ['ship', 'done', undefined],
      ['pack', 'db', undefined],
    ]);
    expect(p.data.edges[3]!.colors).toEqual({ dash: [4, 4] });
    expect(p.data.edges[4]!.colors).toEqual({ width: 3 });
    expect(p.data.edges[7]!.colors).toEqual({ markerEnd: null });
  });

  it('reads heads at either end', () => {
    const p = page('flowchart TD\nA <--> B o--o C --o D --- E');
    expect(p.data.edges.map((e) => e.colors)).toEqual([
      { markerStart: 'arrow' }, { markerStart: 'circle', markerEnd: 'circle' }, { markerEnd: 'circle' }, { markerEnd: null },
    ]);
  });

  it('reads subgraphs as containers, a node in the deepest that names it', () => {
    const p = page(FLOW);
    expect(p.data.containers).toEqual([
      { id: 'warehouse', role: 'container', label: 'Warehouse floor', members: ['pick', 'pack', 'dock'], colors: { fill: '#eee' } },
      { id: 'dock', role: 'container', label: 'Loading dock', members: ['ship'] },
    ]);
  });

  it('reads an edge to a subgraph as one to its container', () => {
    const p = page('flowchart TD\nA --> S\nsubgraph S\nB\nend');
    expect(p.data.nodes.map((n) => n.id)).toEqual(['A', 'B']);
    expect(p.data.edges[0]).toMatchObject({ from: 'A', to: 'S' });
  });

  it('reads colors from classDef, class, :::, style, and linkStyle, the later over the earlier', () => {
    const p = page(FLOW);
    expect(node(p.data, 'check').colors).toEqual({ fill: '#f96', stroke: '#333', strokeWidth: 4 });
    expect(node(p.data, 'done').colors).toEqual({ fill: '#bbf', text: '#000' });
    expect(p.data.edges[0]!.colors).toEqual({ stroke: '#f00', label: '#00f' });
    const q = page('flowchart TD\nclassDef default fill:#111\nclassDef x fill:#222\nA:::x --> B\nstyle A fill:#333\nlinkStyle default stroke:#444,stroke-dasharray: 5 5');
    expect(q.data.nodes.map((n) => n.colors)).toEqual([{ fill: '#333' }, { fill: '#111' }]);
    expect(q.data.edges[0]!.colors).toEqual({ stroke: '#444', dash: [5, 5] });
  });

  it('warns for each construct a diagram does not hold', () => {
    expect(readFlowchart(FLOW).warnings).toEqual([
      'Mermaid configuration directives were dropped.',
      'Mermaid statements a diagram does not hold were dropped: click.',
      'Mermaid subgraph directions were dropped; the page runs one way.',
      'Mermaid style properties a diagram does not hold were dropped: font-size.',
    ]);
    expect(readFlowchart('flowchart TD\nA ~~~ B\nA --x B').warnings).toEqual([
      'Mermaid invisible links were dropped.', 'Mermaid cross ends read as arrows.',
    ]);
  });
});
