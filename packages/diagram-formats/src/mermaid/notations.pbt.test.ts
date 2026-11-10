import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { C4_NOTATIONS } from './c4/read';
import { docOf, graphData, idText, oddText, outcome, runs, timeoutFor } from '../pbt.fixture';
import type { DataNode } from '@weasel-js/diagram';
import type { DiagramDocument, ImportResult } from '../document';
import { DIAGRAM_MERMAID } from './format';

const RUNS = runs(100);
const TIMEOUT = timeoutFor(100, 40);

const NOTATIONS = ['class', 'state', 'er', 'mindmap', 'requirement', 'block', 'architecture', 'kanban', ...Object.values(C4_NOTATIONS)];

const write = (doc: DiagramDocument) => DIAGRAM_MERMAID.write!(doc).text;
const read = (text: string) => (DIAGRAM_MERMAID.read!(text) as ImportResult).document;

describe('Mermaid graph kinds, property', () => {
  for (const notation of NOTATIONS) {
    it(`writes any graph page as a ${notation} diagram it reads back, and writing is a fixed point after one read`, () => {
      fc.assert(fc.property(graphData({ containers: true, endLabels: true, ports: true }), (data) => {
        const first = outcome(() => write(docOf(data, { notation })));
        if ('error' in first) throw new Error(`writing threw: ${first.error}`);
        const page = read(first.value).pages[0]!;
        expect(page.kind === 'graph' ? page.notation : page.kind).toBe(notation);
        const once = write(read(first.value));
        expect(write(read(once))).toBe(once);
      }), RUNS);
    }, TIMEOUT);
  }

  it('reads back a mind map\'s text and shapes, and the ids it can hold', () => {
    const outline = fc.constantFrom(undefined, 'rect', 'roundRect', 'ellipse', 'cloud', 'hexagon');
    const chain = fc.uniqueArray(idText, { minLength: 1, maxLength: 6 }).chain((ids) => fc.tuple(
      ...ids.map((id) => fc.record({ lines: fc.array(oddText, { maxLength: 3 }), outline }).map(({ lines, outline: o }): DataNode =>
        ({ id, lines, ...(o !== undefined ? { outline: o } : {}) }))),
    ));
    fc.assert(fc.property(chain, (nodes) => {
      const edges = nodes.slice(1).map((n, i) => ({ from: nodes[i]!.id, to: n.id }));
      const page = read(write(docOf({ nodes, edges }, { notation: 'mindmap' }))).pages[0]!;
      if (page.kind !== 'graph') throw new Error('not a graph page');
      expect(page.data.nodes.map((n) => [n.lines, n.outline])).toEqual(
        nodes.map((n) => [n.lines!.every((l) => l.trim() === '') ? [] : n.lines!.map((l) => l.trim()), n.outline]),
      );
      const kept = nodes.filter((n) => n.outline !== undefined && /^[\w-]+$/.test(n.id)).map((n) => n.id);
      for (const id of kept) expect(page.data.nodes.map((n) => n.id)).toContain(id);
    }), RUNS);
  }, TIMEOUT);

  it('reads any text under any kind\'s header to a page, or throws an error naming the line', () => {
    const tally = { read: 0, refused: 0 };
    const header = fc.constantFrom('flowchart TD', 'graph LR', 'classDiagram', 'stateDiagram-v2', 'erDiagram', 'mindmap', 'requirementDiagram',
      'sequenceDiagram', 'xychart-beta', 'gantt', 'timeline', 'pie showData', 'quadrantChart', 'journey', 'gitGraph', 'sankey-beta',
      'packet-beta', 'radar-beta', 'block-beta', 'architecture-beta', 'C4Context', 'C4Deployment', 'kanban');
    const token = fc.constantFrom('A', 'B', 'a1', '-->', '--', '..', '->>', '-->>', ':', ';', ',', '"', '[', ']', '(', ')', '{', '}', '<<', '>>',
      'end', 'section', 'title', 'class', 'state', 'note', 'Note over A', 'participant', 'loop', 'alt', 'else', 'commit', 'branch',
      'checkout', 'merge', 'x-axis', 'y-axis', 'bar', 'line', '[1, 2]', '1 --> 5', '0-15', '+8', 'axis', 'curve', 'columns', 'block:',
      'service', 'group', 'junction', 'in', 'Person(', 'Rel(', 'Boundary(', '%%', '[*]', '|o--o{', '||--|{', '::icon(x)', ':::c', '@{',
      'dateFormat', 'after', '3d', '2024-01-01', '1e400', '-1', 'NaN', '\t', ' ', '  ', '    ');
    const body = fc.array(fc.array(fc.oneof({ weight: 4, arbitrary: token }, { weight: 1, arbitrary: oddText }), { maxLength: 7 })
      .map((t) => t.join(' ')), { maxLength: 8 });
    fc.assert(fc.property(header, body, fc.boolean(), (h, lines, indent) => {
      const text = [h, ...lines.map((l, i) => (indent ? '  '.repeat(1 + (i % 3)) : '  ') + l)].join('\n');
      const r = outcome(() => DIAGRAM_MERMAID.read!(text) as ImportResult);
      if ('error' in r) {
        tally.refused++;
        expect(r.error, text).toMatch(/^Mermaid, line \d+: /);
        return;
      }
      tally.read++;
      const doc = r.value.document;
      expect(doc.pages.length, text).toBe(1);
      const written = outcome(() => write(doc));
      if ('error' in written) expect(written.error, text).toMatch(/^Mermaid's main branch is "main"/);
    }), RUNS);
    expect(tally.read).toBeGreaterThan(0);
    expect(tally.refused).toBeGreaterThan(0);
  }, TIMEOUT);
});
