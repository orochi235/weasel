import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { DiagramData } from '@weasel-js/diagram';
import { asGraph } from '../testing/asGraph';
import { brokenText, docOf, graphData, idText, outcome, runs, timeoutFor } from '../pbt.fixture';
import { readDot } from './read';
import { writeDot } from './write';

const RUNS = runs(150);
const TIMEOUT = timeoutFor(150, 30);

const anyGraph = fc.boolean().chain((placed) => graphData({ placed, containers: true, ports: true, endLabels: true }));
const written = (data: DiagramData) => writeDot(docOf(data)).text;
const read = (text: string) => readDot(text).document;

/** What may sit between two statements without changing what a file says. */
const filler = fc.constantFrom('', '   ', '\t', '// a comment', '/* a comment */', '/* one\nover lines */', '# a preprocessor line', '//', '/**/');

/** `text`'s lines with `between[i]` before line `i`, comments after the statements that end in `;` or `{`, and its
 *  indents swapped for `indent`. */
function dressed(text: string, between: readonly string[], trailing: boolean, indent: string): string {
  return text.trimEnd().split('\n').map((line, i) => {
    const body = line.replace(/^ +/, (lead) => indent.repeat(lead.length / 2));
    const tail = trailing && /[;{]$/.test(line) ? ' /* after */' : '';
    return `${between[i % Math.max(1, between.length)] ?? ''}\n${body}${tail}`;
  }).join('\n');
}

/** The edges as a multiset, their ids aside: the reader numbers ids for repeated ends in the order it meets them. */
const sortedEdges = (data: DiagramData) => data.edges.map(({ id: _id, ...e }) => JSON.stringify(e)).sort();

describe('DOT, metamorphic', () => {
  it('reads the same document with comments, blank lines, and other indents between its statements', () => {
    fc.assert(fc.property(anyGraph, fc.array(filler, { maxLength: 8 }), fc.boolean(), fc.constantFrom('', ' ', '\t', '    '), (data, between, trailing, indent) => {
      const text = written(data);
      expect(read(dressed(text, between, trailing, indent))).toEqual(read(text));
    }), RUNS);
  }, TIMEOUT);

  it('reads the same document with its lines ended by "\\r\\n" or run onto one line', () => {
    fc.assert(fc.property(anyGraph, fc.constantFrom('\r\n', ' ', ''), (data, end) => {
      const text = written(data);
      expect(read(text.replace(/\n/g, end))).toEqual(read(text));
    }), RUNS);
  }, TIMEOUT);

  it('reads the same nodes and edges with the top-level statements in any order', () => {
    fc.assert(fc.property(fc.boolean().chain((placed) => graphData({ placed, ports: true, endLabels: true })), fc.nat(), (data, seed) => {
      const lines = written(data).trimEnd().split('\n');
      const first = lines.findIndex((l) => l.startsWith('  edge')) + 1;
      const shuffled = lines.slice(first, -1).sort((a, b) => hash(a, seed) - hash(b, seed) || (a < b ? -1 : 1));
      const before = asGraph(read(lines.join('\n')).pages[0]!).data;
      const after = asGraph(read([...lines.slice(0, first), ...shuffled, lines.at(-1)!].join('\n')).pages[0]!).data;
      expect(after.nodes.map((n) => JSON.stringify(n)).sort()).toEqual(before.nodes.map((n) => JSON.stringify(n)).sort());
      expect(sortedEdges(after)).toEqual(sortedEdges(before));
    }), RUNS);
  }, TIMEOUT);

  it('reads a node statement given twice as given once', () => {
    fc.assert(fc.property(anyGraph, fc.nat(), (data, pick) => {
      const lines = written(data).trimEnd().split('\n');
      const nodeLines = lines.map((l, i) => [l, i] as const).filter(([l]) => /^\s*("(?:[^"\\]|\\.)*"|[^\s"]+) \[label=/.test(l) && !l.includes(' -> '));
      if (nodeLines.length === 0) return;
      const [line, at] = nodeLines[pick % nodeLines.length]!;
      expect(read([...lines.slice(0, at + 1), line, ...lines.slice(at + 1)].join('\n'))).toEqual(read(lines.join('\n')));
    }), RUNS);
  }, TIMEOUT);

  it('reads back ids and labels holding line breaks and any code unit', () => {
    const anyText = fc.oneof(brokenText, fc.string({ unit: 'binary', maxLength: 6 }), idText);
    const data = fc.uniqueArray(anyText.filter((t) => t !== ''), { minLength: 1, maxLength: 5 }).chain((ids) => fc.record({
      lines: fc.array(fc.array(anyText, { maxLength: 2 }), { minLength: ids.length, maxLength: ids.length }),
      edges: fc.array(fc.record({ from: fc.constantFrom(...ids), to: fc.constantFrom(...ids), label: anyText.filter((t) => t !== '') }), { maxLength: 4 }),
    }).map(({ lines, edges }): DiagramData => ({ nodes: ids.map((id, i) => ({ id, lines: lines[i]! })), edges })));
    fc.assert(fc.property(data, (d) => {
      const p = asGraph(read(written(d)).pages[0]!).data;
      expect(p.nodes.map((n) => [n.id, n.lines])).toEqual(d.nodes.map((n) => [n.id, n.lines!.length === 1 && n.lines![0] === '' ? [] : n.lines]));
      expect(p.edges.map((e) => [e.from, e.to, e.label])).toEqual(d.edges.map((e) => [e.from, e.to, e.label]));
    }), RUNS);
  }, TIMEOUT);

  it('reads subgraphs nested to any depth, or throws an error naming the line', () => {
    fc.assert(fc.property(fc.constantFrom(1, 10, 200, 1_000, 1_001, 30_000), fc.boolean(), fc.boolean(), (depth, named, cluster) => {
      const open = named ? `subgraph ${cluster ? 'cluster_' : ''}s {` : '{';
      const text = `digraph {\n${open.repeat(depth)} a ${'}'.repeat(depth)}\n}\n`;
      const r = outcome(() => read(text));
      if ('error' in r) {
        expect(r.error).toMatch(/^DOT, line \d+: /);
        return;
      }
      expect(asGraph(r.value.pages[0]!).data.nodes.map((n) => n.id)).toEqual(['a']);
    }), { ...RUNS, numRuns: Math.min(RUNS.numRuns, 30) });
  }, TIMEOUT);
});

/** A number standing for `s` under `seed`, so a sort by it is a shuffle fast-check can shrink. */
function hash(s: string, seed: number): number {
  let h = seed | 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x9e3779b1);
  return h;
}
