import { describe, expect, it } from 'vitest';
import { asGraph } from './testing/asGraph';
import { readDot } from './dot/read';
import { DRAW_XML } from './drawXml/format';
import { readC4 } from './mermaid/c4/read';
import { readFlowchart } from './mermaid/flowchart/read';
import { readStateDiagram } from './mermaid/state/read';
import { checkedColor } from './colorCheck';

const graph = (r: { document: { pages: readonly unknown[] } }) => asGraph(r.document.pages[0] as never);

describe('one color check for every reader', () => {
  it('keeps what paint reads and reports the rest', () => {
    const bad: string[] = [];
    const list = (_lead: string, item: string) => bad.push(item);
    expect(['#f00', 'rgb(1 2 3 / 50%)', 'steelblue', 'transparent', 'nope', ''].map((c) => checkedColor(c, 'X', list)))
      .toEqual(['#f00', 'rgb(1 2 3 / 50%)', 'steelblue', 'transparent', undefined, undefined]);
    expect(bad).toEqual(['nope', '']);
  });

  it('DOT drops a color it cannot draw, an X11 name CSS lacks or a palette entry, and reads none as transparent', () => {
    const r = readDot('digraph { a [color="grey50", fontcolor="/blues9/3", style=filled, fillcolor=none]; a -> b [color="red"] }');
    expect(graph(r).data.nodes[0]!.colors).toEqual({ fill: 'transparent' });
    expect(graph(r).data.edges[0]!.colors).toEqual({ stroke: 'red' });
    expect(r.warnings).toContain('DOT colors a diagram cannot draw were dropped: grey50, /blues9/3.');
  });

  it('a Mermaid flowchart drops a style or link style color it cannot draw', () => {
    const r = readFlowchart('flowchart TD\nA --> B\nstyle A fill:bogus,stroke:#00f\nlinkStyle 0 stroke:wat');
    expect(graph(r).data.nodes[0]!.colors).toMatchObject({ stroke: '#00f' });
    expect(graph(r).data.nodes[0]!.colors?.fill).toBeUndefined();
    expect(graph(r).data.edges[0]!.colors?.stroke).toBeUndefined();
    expect(r.warnings).toContain('Mermaid colors a diagram cannot draw were dropped: bogus, wat.');
  });

  it('a Mermaid kind reading classDefs drops a color it cannot draw', () => {
    const r = readStateDiagram('stateDiagram-v2\nA --> B\nclassDef x fill:bogus,color:#fff\nclass A x');
    const a = graph(r).data.nodes.find((n) => n.id === 'A')!;
    expect(a.colors).toEqual({ text: '#fff' });
    expect(r.warnings).toContain('Mermaid colors a diagram cannot draw were dropped: bogus.');
  });

  it('Mermaid C4 drops a style color it cannot draw', () => {
    const r = readC4('C4Context\nPerson(p, "P")\nUpdateElementStyle(p, $bgColor="bogus", $fontColor="#fff")');
    expect(graph(r).data.nodes[0]!.colors).toEqual({ text: '#fff' });
    expect(r.warnings).toContain('Mermaid colors a diagram cannot draw were dropped: bogus.');
  });

  it('draw-style XML drops a color it cannot draw', async () => {
    const xml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
      + '<mxCell id="a" value="A" style="fillColor=bogus;strokeColor=#00ff00;fontColor=zz;" vertex="1" parent="1">'
      + '<mxGeometry x="10" y="10" width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel>';
    const r = await DRAW_XML.read!(xml);
    expect(graph(r).data.nodes[0]!.colors).toEqual({ stroke: '#00ff00' });
    expect(r.warnings).toContain('Draw-style XML colors a diagram cannot draw were dropped: bogus, zz.');
  });
});
