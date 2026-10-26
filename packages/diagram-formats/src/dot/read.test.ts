import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataNode, DiagramData } from '@weasel-js/diagram';
import { readDot } from './read';

const fixture = (name: string) => readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8');
const page = (text: string) => readDot(text).document.pages[0]!;
const node = (data: DiagramData, id: string) => data.nodes.find((n) => n.id === id) as DataNode;

describe('reading DOT', () => {
  it('reads a graph to one page, laid out the way rankdir says, named by its label', () => {
    const p = page(fixture('clusters.dot'));
    expect(readDot(fixture('clusters.dot')).document.pages).toHaveLength(1);
    expect(p).toMatchObject({ name: 'Process', direction: 'right' });
    expect(p.data.nodes.every((n) => n.at === undefined)).toBe(true);
    expect(page('digraph G { a }').name).toBe('G');
    expect(page('digraph { rankdir=BT a }').direction).toBe('up');
  });

  it('reads clusters as containers, with their labels, members, and colors', () => {
    const p = page(fixture('clusters.dot'));
    expect(p.data.containers).toEqual([
      { id: '0', role: 'container', label: 'process #1', members: ['a0', 'a1', 'a2', 'a3'], colors: { fill: 'lightgrey', stroke: 'lightgrey' } },
      { id: '1', role: 'container', label: 'process #2', members: ['b0', 'b1', 'b2', 'b3'], colors: { stroke: 'blue' } },
    ]);
  });

  it('reads plain subgraphs as scopes only, and nests clusters', () => {
    const p = page('digraph { subgraph cluster_x { subgraph { rank=same; a } subgraph cluster_y { b } } c }');
    expect(p.data.containers).toEqual([
      { id: 'x', role: 'container', members: ['a', 'y'] },
      { id: 'y', role: 'container', members: ['b'] },
    ]);
  });

  it('applies node defaults in their scope, and explicit attributes over them', () => {
    const p = page(fixture('clusters.dot'));
    expect(node(p.data, 'a0')).toMatchObject({ outline: 'rect', lines: ['a0'], colors: { fill: '#eeeeee', stroke: 'white' } });
    expect(node(p.data, 'b0').colors).toEqual({ fill: '#eeeeee' });
    expect(node(p.data, 'start')).toMatchObject({ outline: 'diamond', lines: ['Start', 'here'] });
  });

  it('reads each shape of the table, and the rest as rects with a warning', () => {
    const { document, warnings } = readDot(fixture('shapes.dot'));
    const outlines = Object.fromEntries(document.pages[0]!.data.nodes.map((n) => [n.id, n.outline]));
    expect(outlines).toEqual({
      r: 'rect', s: 'roundRect', d: 'diamond', e: 'ellipse', plain: 'ellipse', h: 'hexagon', p: 'parallelogram',
      t: 'trapezoid', c: 'ellipse', cyl: 'cylinder', n: 'note', html: 'ellipse',
    });
    expect(warnings.some((w) => w.startsWith('DOT shapes read as rectangles'))).toBe(false);
    expect(readDot('graph g { a [shape=star]; b [shape=box3d] }').warnings).toContain('DOT shapes read as rectangles: star.');
  });

  it('reads HTML labels as their text', () => {
    expect(node(page(fixture('shapes.dot')).data, 'html').lines).toEqual(['Bold', 'and & more']);
  });

  it('reads escapes in labels: line breaks, the node name, and backslashes', () => {
    const p = page('digraph g { a [label="\\N is\\lleft\\rright\\\\"]; b [label="in \\G"] }');
    expect(node(p.data, 'a').lines).toEqual(['a is', 'left', 'right\\']);
    expect(node(p.data, 'b').lines).toEqual(['in g']);
  });

  it('reads edge chains, labels, colors, and dashes', () => {
    const p = page(fixture('clusters.dot'));
    expect(p.data.edges.filter((e) => e.from === 'a0' || e.from === 'a1').map((e) => [e.from, e.to])).toEqual([['a0', 'a1'], ['a1', 'a2'], ['a1', 'b3']]);
    expect(p.data.edges.find((e) => e.label === 'loop')).toMatchObject({ from: 'a3', to: 'a0', colors: { stroke: '#cc0000', dash: [6, 4] } });
    expect(new Set(p.data.edges.map((e) => e.id)).size).toBe(p.data.edges.length);
  });

  it('reads compass ports, and drops named ports and corners with a warning', () => {
    const { document, warnings } = readDot(fixture('shapes.dot'));
    const edges = document.pages[0]!.data.edges;
    expect(edges.find((e) => e.from === 'e')).toMatchObject({ fromPort: 'n', toPort: 's' });
    const pt = edges.find((e) => e.from === 'p')!;
    expect(pt.fromPort).toBeUndefined();
    expect(pt.toPort).toBeUndefined();
    expect(warnings).toContain('DOT ports a diagram does not have were dropped: p:port1, t:ne.');
  });

  it('draws an undirected graph\'s edges with no arrowhead, and reads dir and arrowheads', () => {
    expect(page(fixture('shapes.dot')).data.edges[0]!.colors).toEqual({ markerEnd: null });
    const p = page('digraph { a -> b [dir=both, arrowtail=odot]; b -> c [arrowhead=none]; c -> d [dir=back] }');
    expect(p.data.edges.map((e) => e.colors)).toEqual([
      { markerStart: 'circle' }, { markerEnd: null }, { markerStart: 'arrow', markerEnd: null },
    ]);
  });

  it('keeps one edge per pair of ends in a strict graph', () => {
    expect(page('strict graph { a -- b; b -- a; a -- b }').data.edges).toHaveLength(1);
    expect(page('graph { a -- b; a -- b }').data.edges).toHaveLength(2);
  });

  it('makes an edge to every node of a subgraph it names', () => {
    const p = page('digraph { a -> { b c } }');
    expect(p.data.edges.map((e) => e.to)).toEqual(['b', 'c']);
  });

  it('places every node where pos says when every node has one, and sizes the page by bb', () => {
    const p = page(fixture('positioned.dot'));
    expect(p).toMatchObject({ width: 300, height: 200 });
    expect(node(p.data, 'a')).toMatchObject({ at: { x: 14, y: 2 }, width: 72, height: 36 });
    expect(node(p.data, 'b')).toMatchObject({ at: { x: 196, y: 152 }, width: 108, height: 36 });
    expect(page('digraph { a [pos="1,1"]; b }').data.nodes.every((n) => n.at === undefined)).toBe(true);
  });

  it('reads colors in each of DOT\'s spellings', () => {
    const p = page('digraph { a [color="/x11/red:blue"]; b [color="0.000 1.000 1.000"]; c [fontcolor="#ff000080"] }');
    expect(p.data.nodes.map((n) => n.colors)).toEqual([{ stroke: 'red' }, { stroke: '#ff0000' }, { text: '#ff000080' }]);
  });

  it('lists the attributes it dropped in one warning', () => {
    const { warnings } = readDot(fixture('clusters.dot'));
    expect(warnings).toContain('DOT shapes read as rectangles: Msquare.');
    expect(warnings).toContain('DOT attributes a diagram does not hold were dropped: fontname.');
    expect(readDot(fixture('positioned.dot')).warnings).toEqual(['DOT attributes a diagram does not hold were dropped: pos.']);
  });

  it('names the line of a syntax error', () => {
    expect(() => readDot('digraph {\n a -> ;\n}')).toThrow(/DOT, line 2/);
  });
});
