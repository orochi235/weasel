import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { DiagramData } from '@weasel-js/diagram';
import { asGraph } from '../testing/asGraph';
import { docOf, graphData, outcome, runs, timeoutFor, tokenSoup } from '../pbt.fixture';
import { DIAGRAM_DOT } from './format';
import { readDot } from './read';
import { writeDot } from './write';

const RUNS = runs(200);
const TIMEOUT = timeoutFor(200, 20);

const back = (data: DiagramData, name?: string) =>
  asGraph(readDot(writeDot(docOf(data, name !== undefined ? { name } : {})).text).document.pages[0]!);

/** A label's lines as DOT reads them back: one empty line is no text at all. */
const dotLines = (lines: readonly string[]): readonly string[] => (lines.length === 1 && lines[0] === '' ? [] : lines);

describe('DOT, property', () => {
  it('reads back what it writes: ids, lines, outlines, edges, and labels', () => {
    fc.assert(fc.property(graphData(), (data) => {
      const p = back(data);
      expect(p.data.nodes.map((n) => [n.id, n.lines, n.outline])).toEqual(data.nodes.map((n) => [n.id, dotLines(n.lines!), n.outline]));
      expect(p.data.edges.map((e) => [e.from, e.to, e.label])).toEqual(
        data.edges.map((e) => [e.from, e.to, e.label === '' ? undefined : e.label]),
      );
    }), RUNS);
  }, TIMEOUT);

  it('reads back clusters as the containers they were written from, and edges\' ports and end labels', () => {
    const tally = { containers: 0, ports: 0, endLabels: 0 };
    fc.assert(fc.property(graphData({ containers: true, ports: true, endLabels: true }), (data) => {
      const p = back(data);
      tally.containers += data.containers?.length ?? 0;
      tally.ports += data.edges.filter((e) => e.fromPort !== undefined || e.toPort !== undefined).length;
      tally.endLabels += data.edges.filter((e) => e.endLabels !== undefined).length;
      // A cluster is written inside the one holding it, and its nodes inside it, so the lists keep their order
      // only within one cluster.
      const byId = <T extends { id: string }>(xs: readonly T[] | undefined) => [...(xs ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));
      expect(byId(p.data.containers).map((c) => [c.id, c.label, c.members])).toEqual(
        byId(data.containers).map((c) => [c.id, c.label === '' ? undefined : c.label, c.members]),
      );
      expect(p.data.nodes.map((n) => n.id).sort()).toEqual(data.nodes.map((n) => n.id).sort());
      expect(p.data.edges.map((e) => [e.from, e.fromPort, e.to, e.toPort, e.endLabels])).toEqual(
        data.edges.map((e) => [e.from, e.fromPort, e.to, e.toPort, e.endLabels]),
      );
    }), RUNS);
    expect(tally.containers).toBeGreaterThan(0);
    expect(tally.ports).toBeGreaterThan(0);
    expect(tally.endLabels).toBeGreaterThan(0);
  }, TIMEOUT);

  it('keeps a page name and places', () => {
    fc.assert(fc.property(graphData({ placed: true }), fc.string({ minLength: 1, maxLength: 8 }), (data, name) => {
      const p = back(data, name);
      expect(p.name).toBe(name);
      expect(p.data.nodes.map((n) => [n.at, n.width, n.height])).toEqual(data.nodes.map((n) => [n.at, n.width, n.height]));
    }), RUNS);
  }, TIMEOUT);

  it('writes what it read as it was written: writing is a fixed point after one read', () => {
    fc.assert(fc.property(fc.boolean().chain((placed) => graphData({ placed, containers: true, ports: true, endLabels: true })), (data) => {
      const once = writeDot(readDot(writeDot(docOf(data)).text).document).text;
      expect(writeDot(readDot(once).document).text).toBe(once);
    }), RUNS);
  }, TIMEOUT);

  it('reads any text to a diagram, or throws an error naming the line', () => {
    const tally = { read: 0, refused: 0 };
    const text = fc.oneof(
      fc.string({ maxLength: 60 }),
      tokenSoup(['digraph', 'graph', 'strict', 'subgraph', 'node', 'edge', '{', '}', '[', ']', ';', ',', '=', ':', '->', '--',
        '"', '<', '>', 'label', 'cluster_a', 'shape', 'style', 'pos', 'rankdir', '\\N', '/*', '*/', '//', '#', '+']),
      tokenSoup(['{', '}', '[', ']', ';', '=', '->', 'a', 'b', 'label="x"', 'subgraph cluster_x', 'pos="1,2"', 'width=1'])
        .map((body) => `digraph {\n${body}\n}`),
    );
    fc.assert(fc.property(text, (t) => {
      const r = outcome(() => readDot(t));
      if ('error' in r) {
        tally.refused++;
        expect(r.error).toMatch(/^DOT, line \d+: /);
        return;
      }
      tally.read++;
      const doc = r.value.document;
      for (const n of asGraph(doc.pages[0]!).data.nodes) {
        if (n.at !== undefined) expect(Number.isFinite(n.at.x) && Number.isFinite(n.at.y)).toBe(true);
      }
      const again = writeDot(doc).text;
      expect(DIAGRAM_DOT.detect(again)).toBe(true);
      expect(writeDot(readDot(again).document).text).toBe(writeDot(readDot(writeDot(readDot(again).document).text).document).text);
    }), RUNS);
    expect(tally.read).toBeGreaterThan(0);
    expect(tally.refused).toBeGreaterThan(0);
  }, TIMEOUT);

  it('detects what it writes', () => {
    fc.assert(fc.property(graphData(), fc.option(fc.string({ maxLength: 8 }), { nil: undefined }), (data, name) => {
      expect(DIAGRAM_DOT.detect(writeDot(docOf(data, name !== undefined ? { name } : {})).text)).toBe(true);
    }), RUNS);
  }, TIMEOUT);
});
