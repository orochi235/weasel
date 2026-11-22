import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataNode, DiagramData } from '@weasel-js/diagram';
import { readDot } from './read';
import { asGraph } from '../testing/asGraph';

const fixture = (name: string) => readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8');
const page = (text: string) => readDot(text).document.pages.map(asGraph)[0]!;
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

  it('reads an invisible cluster as a container that draws nothing, around members it still draws', () => {
    const p = page('digraph { subgraph cluster_a { style=invis; label=A; color=red; x; y } }');
    expect(p.data.containers).toEqual([
      { id: 'a', role: 'container', members: ['x', 'y'], colors: { fill: 'transparent', stroke: 'transparent' } },
    ]);
    expect(p.data.nodes.map((n) => n.id)).toEqual(['x', 'y']);
  });

  it('reads a node\'s outline from its shape when weasel_outline is empty or names no outline', () => {
    const { document, warnings } = readDot('digraph { a [shape=diamond, weasel_outline=""]; b [weasel_outline=blob]; c [weasel_outline=stadium] }');
    expect(asGraph(document.pages[0]!).data.nodes.map((n) => n.outline)).toEqual(['diamond', 'ellipse', 'stadium']);
    expect(warnings).toEqual(['DOT outlines a diagram does not have were read from the shape: blob.']);
  });

  it('reads a tailport or headport set to "" as unset, with no warning', () => {
    const { document, warnings } = readDot('digraph { a -> b [tailport="", headport=""] }');
    expect(asGraph(document.pages[0]!).data.edges[0]).not.toHaveProperty('fromPort');
    expect(warnings).toEqual([]);
  });

  it('reads a subgraph as a cluster by its prefix in any case, or by cluster=true', () => {
    const { document, warnings } = readDot(
      'digraph { subgraph Cluster_A { a } subgraph g { cluster=true; b } subgraph { graph [cluster=yes] c } subgraph h { cluster=false; d } }',
    );
    expect(asGraph(document.pages[0]!).data.containers).toEqual([
      { id: 'A', role: 'container', members: ['a'] },
      { id: 'g', role: 'container', members: ['b'] },
      { id: 'cluster', role: 'container', members: ['c'] },
    ]);
    expect(warnings).toEqual([]);
  });

  it('keeps a cluster named with a NUL apart from one with no name', () => {
    const p = page('digraph { subgraph { cluster=1; a } subgraph "\u00000" { cluster=1; b } }');
    expect(p.data.containers?.map((c) => c.members)).toEqual([['a'], ['b']]);
  });

  it('reads \\G in a cluster label as the cluster\'s name, and keeps \\N where no node owns the label', () => {
    const p = page('digraph G { label="\\G \\N"; subgraph cluster_x { label="\\G \\N"; a } a -> b [label="\\N"] }');
    expect(p.name).toBe('G \\N');
    expect(p.data.containers![0]!.label).toBe('cluster_x \\N');
    expect(p.data.edges[0]!.label).toBe('\\N');
  });

  it('reads plain subgraphs as scopes only, and nests clusters', () => {
    const p = page('digraph { subgraph cluster_x { subgraph { rank=same; a } subgraph cluster_y { b } } c }');
    expect(p.data.containers).toEqual([
      { id: 'x', role: 'container', members: ['a', 'y'] },
      { id: 'y', role: 'container', members: ['b'] },
    ]);
  });

  it("gives a cluster an id no node holds when its short name and its full name are both nodes'", () => {
    const p = page('digraph { x; cluster_x; subgraph cluster_x { a } }');
    const ids = [...p.data.nodes.map((n) => n.id), ...p.data.containers!.map((c) => c.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(p.data.containers![0]!.members).toEqual(['a']);
  });

  it('applies node defaults in their scope, and explicit attributes over them', () => {
    const p = page(fixture('clusters.dot'));
    expect(node(p.data, 'a0')).toMatchObject({ outline: 'rect', lines: ['a0'], colors: { fill: '#eeeeee', stroke: 'white' } });
    expect(node(p.data, 'b0').colors).toEqual({ fill: '#eeeeee' });
    expect(node(p.data, 'start')).toMatchObject({ outline: 'diamond', lines: ['Start', 'here'] });
  });

  it('reads each shape of the table, and the rest as rects with a warning', () => {
    const { document, warnings } = readDot(fixture('shapes.dot'));
    const outlines = Object.fromEntries(document.pages.map(asGraph)[0]!.data.nodes.map((n) => [n.id, n.outline]));
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
    const edges = document.pages.map(asGraph)[0]!.data.edges;
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

  it('reads each of Graphviz\'s arrowhead synonyms as the arrowhead it names', () => {
    const heads = (a: string, b: string) => page(`digraph { a -> b [arrowhead=${a}]; b -> c [arrowhead=${b}] }`).data.edges
      .map((e) => e.colors?.markerEnd);
    for (const [a, b] of [['empty', 'onormal'], ['open', 'vee'], ['ediamond', 'odiamond'], ['invempty', 'oinv']]) {
      const [x, y] = heads(a!, b!);
      expect(x).toBe(y);
      expect(x).not.toBe('arrow');
    }
  });

  it('gives a strict graph\'s merged edge the ports a later statement names', () => {
    expect(page('strict digraph { a -> b; a:n -> b:s [color=red] }').data.edges).toMatchObject([
      { from: 'a', to: 'b', fromPort: 'n', toPort: 's', colors: { stroke: 'red' } },
    ]);
    const [e] = page('strict graph { a -- b:e; b:w -- a }').data.edges;
    expect(e).toMatchObject({ from: 'a', to: 'b', toPort: 'w' });
    expect(e).not.toHaveProperty('fromPort');
  });

  it('keeps one edge per pair of ends in a strict graph', () => {
    expect(page('strict graph { a -- b; b -- a; a -- b }').data.edges).toHaveLength(1);
    expect(page('strict digraph { "a\u0000b" -> c; a -> "b\u0000c" }').data.edges).toHaveLength(2);
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

  it('sizes the page around every node when there is no bb, a node left of or below the origin included', () => {
    const p = page('digraph { a [pos="0.1389,0.2778!", width=1, height=1]; b [pos="1.3889,-0.4167"]; }');
    expect(node(p.data, 'a').at).toEqual({ x: 0, y: 0 });
    expect(node(p.data, 'b').at).toEqual({ x: 99, y: 68 });
    expect(node(p.data, 'b')).toMatchObject({ width: 54, height: 36 });
    expect(p).toMatchObject({ width: 153, height: 104 });
    expect(page('digraph { a [pos="Infinity,1"]; }').data.nodes[0]!.at).toBeUndefined();
  });

  it('reads a pos as inches in a graph with no bb, as neato reads its input', () => {
    const p = page('graph { a [pos="0,0!"]; b [pos="2,0!"]; }');
    expect(node(p.data, 'b').at!.x - node(p.data, 'a').at!.x).toBe(144);
  });

  it('reads colors in each of DOT\'s spellings', () => {
    const p = page('digraph { a [color="/x11/red:blue"]; b [color="0.000 1.000 1.000"]; c [fontcolor="#ff000080"] }');
    expect(p.data.nodes.map((n) => n.colors)).toEqual([{ stroke: 'red' }, { stroke: '#ff0000' }, { text: '#ff000080' }]);
  });

  it('drops a color from a palette scheme CSS has no spelling for, with a warning', () => {
    const { document, warnings } = readDot('digraph { a [color="/blues9/3", fontcolor="/svg/navy"]; a -> b [color="/accent3/1"] }');
    const p = asGraph(document.pages[0]!);
    expect(p.data.nodes[0]!.colors).toEqual({ text: 'navy' });
    expect(p.data.edges[0]!.colors).toBeUndefined();
    expect(warnings).toContain('DOT colors a diagram cannot draw were dropped: /blues9/3, /accent3/1.');
  });

  it('lists the attributes it dropped in one warning', () => {
    const { warnings } = readDot(fixture('clusters.dot'));
    expect(warnings).toContain('DOT shapes read as rectangles: Msquare.');
    expect(warnings).toContain('DOT attributes a diagram does not hold were dropped: fontname.');
    expect(readDot(fixture('positioned.dot')).warnings).toEqual(['DOT attributes a diagram does not hold were dropped: pos.']);
  });

  it('drops a size or pen width that is not a number, with a warning', () => {
    const { document, warnings } = readDot('digraph { a [width=wide, penwidth=thick]; a -> b [penwidth=" "] }');
    const p = asGraph(document.pages[0]!);
    expect(node(p.data, 'a')).not.toHaveProperty('width');
    expect(node(p.data, 'a')).not.toHaveProperty('colors');
    expect(p.data.edges[0]).not.toHaveProperty('colors');
    expect(warnings).toContain('DOT attributes that are not numbers were dropped: penwidth=thick, width=wide, penwidth= .');
  });

  it('reads a size or pen width set to "" as unset, as Graphviz does, with no warning', () => {
    const { document, warnings } = readDot('digraph { a [width="", penwidth=""]; a -> b [penwidth=""] }');
    const p = asGraph(document.pages[0]!);
    expect(node(p.data, 'a')).not.toHaveProperty('width');
    expect(node(p.data, 'a')).not.toHaveProperty('colors');
    expect(p.data.edges[0]).not.toHaveProperty('colors');
    expect(warnings).toEqual([]);
  });

  it('reads an edge label\'s names for the edge, its tail, and its head', () => {
    expect(page('digraph { a -> b [label="\\E: \\T to \\H"] }').data.edges[0]!.label).toBe('a->b: a to b');
    expect(page('graph { a -- b [label="\\E"] }').data.edges[0]!.label).toBe('a--b');
  });

  it('keeps one edge per pair in a strict graph, with what each later statement sets', () => {
    const edges = page('strict graph { edge [color=blue]; a -- b; b -- a [color=red]; a -- b [penwidth=2] }').data.edges;
    expect(edges).toHaveLength(1);
    expect(edges[0]!.colors).toMatchObject({ stroke: 'red', width: 2 });
  });

  it('names the line of a syntax error', () => {
    expect(() => readDot('digraph {\n a -> ;\n}')).toThrow(/DOT, line 2/);
  });

  it('keeps a node in a cluster under its own id where a cluster is named as the node is', () => {
    const data = page('digraph { subgraph cluster_a { cluster_a; b } }').data;
    expect(data.containers?.map((c) => [c.id, c.members])).toEqual([['a', ['cluster_a', 'b']]]);
  });
});

describe('reading invisible DOT items', () => {
  it('leaves out an invisible node, its edges, and an invisible edge, with a warning', () => {
    const { document, warnings } = readDot('digraph { subgraph cluster_k { a; c } b; a -> b [style=invis]; b -> c; c [style="invis"]; a -> b }');
    const data = asGraph(document.pages[0]!).data;
    expect(data.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(data.edges.map((e) => [e.from, e.to])).toEqual([['a', 'b']]);
    expect(data.containers?.map((k) => k.members)).toEqual([['a']]);
    expect(warnings).toContain('DOT invisible nodes and edges were left out: c, a->b.');
  });
});

describe('reading DOT points', () => {
  it('reads a point as a small filled circle with no label, the smaller of its sizes across', () => {
    const data = page('digraph { node [shape=point]; a -> b; c [width=0.2, height=0.1]; d [color=red] }').data;
    expect(node(data, 'a')).toMatchObject({ lines: [], outline: 'ellipse', width: 3.6, height: 3.6, colors: { fill: 'black' } });
    expect(node(data, 'c')).toMatchObject({ width: 7.2, height: 7.2 });
    expect(node(data, 'd').colors).toMatchObject({ fill: 'red', stroke: 'red' });
  });
});

describe("reading a DOT graph's bgcolor", () => {
  it('fills no cluster with the root graph\'s bgcolor, which the page drops, but keeps a cluster\'s own', () => {
    const { document, warnings } = readDot('digraph { bgcolor=lightblue; subgraph cluster_a { x } subgraph cluster_b { bgcolor=pink; y; subgraph cluster_c { z } } }');
    const fills = asGraph(document.pages[0]!).data.containers?.map((k) => k.colors?.fill);
    expect(fills).toEqual([undefined, 'pink', 'pink']);
    expect(warnings).toContain('DOT attributes a diagram does not hold were dropped: bgcolor.');
  });
});

describe('reading DOT keywords set to ""', () => {
  it('reads an empty arrowhead, arrowtail, shape, or dir as Graphviz\'s default, with no warning', () => {
    const { document, warnings } = readDot('digraph { a [shape=""]; a -> b [arrowhead="", arrowtail="", dir=""] }');
    const data = asGraph(document.pages[0]!).data;
    expect(node(data, 'a').outline).toBe('ellipse');
    expect(data.edges[0]!.colors?.markerStart).toBeUndefined();
    expect(data.edges[0]!.colors?.markerEnd).toBeUndefined();
    expect(warnings).toEqual([]);
  });
});
