import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { DiagramData } from '@weasel-js/diagram';
import { asGraph } from '../../testing/asGraph';
import { docOf, graphData, outcome, runs, timeoutFor, tokenSoup } from '../../pbt.fixture';
import { DIAGRAM_MERMAID } from '../format';
import { mermaidIds } from '../common/text';
import { readFlowchart } from './read';
import { writeFlowchart } from './write';

const RUNS = runs(200);
const TIMEOUT = timeoutFor(200, 20);

const back = (data: DiagramData, name?: string) =>
  asGraph(readFlowchart(writeFlowchart(docOf(data, name !== undefined ? { name } : {})).text).document.pages[0]!);

/** Text as Mermaid reads it back: each line trimmed, and lines that are all empty as none. */
const trimmed = (lines: readonly string[]) => {
  const out = lines.map((l) => l.trim());
  return out.every((l) => l === '') ? [] : out;
};
const label = (text: string | undefined) => (text === undefined || text.trim() === '' ? undefined : text.trim());

const byId = <T extends { id: string }>(xs: readonly T[] | undefined) => [...(xs ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));

describe('Mermaid flowchart, property', () => {
  it('reads back what it writes, under the ids it renames: lines, outlines, containers, edges, and labels', () => {
    const tally = { renamed: 0, containers: 0 };
    fc.assert(fc.property(graphData({ containers: true }), (data) => {
      const ids = mermaidIds([...data.nodes.map((n) => n.id), ...(data.containers ?? []).map((c) => c.id)], { unicode: true });
      const id = (x: string) => ids.get(x)!;
      tally.renamed += [...ids].filter(([k, v]) => k !== v).length;
      tally.containers += data.containers?.length ?? 0;
      const p = back(data);
      expect(byId(p.data.nodes).map((n) => [n.id, n.lines, n.outline])).toEqual(
        byId(data.nodes.map((n) => ({ ...n, id: id(n.id) }))).map((n) => [n.id, trimmed(n.lines!), n.outline]),
      );
      expect(byId(p.data.containers).map((c) => [c.id, c.label, c.members])).toEqual(
        byId(data.containers?.map((c) => ({ ...c, id: id(c.id) }))).map((c) => [
          c.id, c.label === undefined ? c.id : (label(c.label) ?? ''), c.members?.map(id),
        ]),
      );
      expect(p.data.edges.map((e) => [e.from, e.to, e.label])).toEqual(data.edges.map((e) => [id(e.from), id(e.to), label(e.label)]));
    }), RUNS);
    expect(tally.renamed).toBeGreaterThan(0);
    expect(tally.containers).toBeGreaterThan(0);
  }, TIMEOUT);

  it('keeps a page name and a direction', () => {
    const direction = fc.constantFrom('down', 'up', 'left', 'right') as fc.Arbitrary<'down' | 'up' | 'left' | 'right'>;
    fc.assert(fc.property(graphData(), fc.string({ minLength: 1, maxLength: 8 }), direction, (data, name, dir) => {
      const p = asGraph(readFlowchart(writeFlowchart(docOf(data, { name, direction: dir })).text).document.pages[0]!);
      expect([p.name, p.direction]).toEqual([name, dir]);
    }), RUNS);
  }, TIMEOUT);

  it('writes what it read as it was written: writing is a fixed point after one read', () => {
    fc.assert(fc.property(graphData({ containers: true, endLabels: true, ports: true }), (data) => {
      const once = writeFlowchart(readFlowchart(writeFlowchart(docOf(data)).text).document).text;
      expect(writeFlowchart(readFlowchart(once).document).text).toBe(once);
    }), RUNS);
  }, TIMEOUT);

  it('reads any text to a diagram, or throws an error naming the line', () => {
    const tally = { read: 0, refused: 0 };
    const tokens = ['flowchart', 'graph', 'TD', 'LR', 'subgraph', 'end', 'direction', 'classDef', 'class', 'style', 'linkStyle',
      'click', '-->', '---', '-.->', '==>', '<-->', '--o', '--x', '~~~', '|', '[', ']', '(', ')', '{', '}', '((', '))', '[/', '/]',
      '>', '"', '@{', ':::', ';', '&', '%%', '%%{init: {}}%%', '---\ntitle: x\n---', 'A', 'B', 'e1@', 'default', 'fill:#f00', 'stroke-width:2px'];
    const text = fc.oneof(
      fc.string({ maxLength: 60 }),
      tokenSoup(tokens),
      tokenSoup(tokens).map((body) => `flowchart TD\n${body}`),
    );
    fc.assert(fc.property(text, (t) => {
      const r = outcome(() => readFlowchart(t));
      if ('error' in r) {
        tally.refused++;
        expect(r.error).toMatch(/^Mermaid, line \d+: /);
        return;
      }
      tally.read++;
      const again = writeFlowchart(r.value.document).text;
      expect(DIAGRAM_MERMAID.detect(again)).toBe(true);
      const twice = writeFlowchart(readFlowchart(again).document).text;
      expect(writeFlowchart(readFlowchart(twice).document).text).toBe(twice);
    }), RUNS);
    expect(tally.read).toBeGreaterThan(0);
    expect(tally.refused).toBeGreaterThan(0);
  }, TIMEOUT);
});
