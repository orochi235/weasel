import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { C4_NOTATIONS } from './c4/read';
import { brokenText, docOf, graphData, oddText, outcome, runs, timeoutFor } from '../pbt.fixture';
import type { DiagramDocument, ImportResult, PlotPage } from '../document';
import { DIAGRAM_MERMAID } from './format';
import { CHARTS } from './plots.fixture';

const RUNS = runs(100);
const TIMEOUT = timeoutFor(100, 60);

const NOTATIONS = [undefined, 'class', 'state', 'er', 'mindmap', 'requirement', 'block', 'architecture', 'kanban', ...Object.values(C4_NOTATIONS)];

const write = (doc: DiagramDocument) => DIAGRAM_MERMAID.write!(doc).text;
const read = (text: string) => (DIAGRAM_MERMAID.read!(text) as ImportResult).document;

const broken = fc.oneof({ weight: 2, arbitrary: oddText }, { weight: 1, arbitrary: brokenText });

/** Text Mermaid wrote for a page of any kind, graph or chart. */
const anyText: fc.Arbitrary<string> = fc.oneof(
  fc.tuple(fc.constantFrom(...NOTATIONS), graphData({ containers: true, endLabels: true })).map(([notation, data]) =>
    write(docOf(data, notation !== undefined ? { notation } : {}))),
  fc.oneof(...Object.values(CHARTS)).map((data) => write({ pages: [{ kind: 'plot', id: 'p', width: 800, height: 500, data } as PlotPage] })),
);

/** `text` split at its header: front matter and the header line, then the body's lines. */
function split(text: string): { head: string[]; body: string[] } {
  const lines = text.trimEnd().split('\n');
  const front = lines[0] === '---' ? lines.indexOf('---', 1) + 1 : 0;
  return { head: lines.slice(0, front + 1), body: lines.slice(front + 1) };
}

describe('Mermaid, line ends and comments', () => {
  for (const notation of NOTATIONS) {
    it(`writes a ${notation ?? 'flowchart'} page whose text breaks across lines as text it reads back, a fixed point after one read`, () => {
      fc.assert(fc.property(graphData({ containers: true, endLabels: true, text: broken }), (data) => {
        const first = outcome(() => write(docOf(data, notation !== undefined ? { notation } : {})));
        if ('error' in first) throw new Error(`writing threw: ${first.error}`);
        const back = outcome(() => read(first.value));
        if ('error' in back) throw new Error(`reading threw: ${back.error}\n${first.value}`);
        const once = write(back.value);
        expect(write(read(once))).toBe(once);
      }), RUNS);
    }, TIMEOUT);
  }

  it('reads the same document with its lines ended by "\\r\\n" or "\\r"', () => {
    fc.assert(fc.property(anyText, fc.constantFrom('\r\n', '\r'), (text, end) => {
      expect(read(text.replace(/\n/g, end))).toEqual(read(text));
    }), RUNS);
  }, TIMEOUT);

  it('reads the same document with comments and blank lines between the lines after its header', () => {
    const filler = fc.constantFrom('', '   ', '\t', '%% a comment', '  %% indented', '%%');
    fc.assert(fc.property(anyText, fc.array(filler, { minLength: 1, maxLength: 6 }), (text, between) => {
      const { head, body } = split(text);
      const dressed = [...head, ...body.flatMap((line, i) => [between[i % between.length]!, line])].join('\n');
      expect(read(dressed)).toEqual(read(text));
    }), RUNS);
  }, TIMEOUT);

  it('reads text holding a line or paragraph separator, or a next-line character, to a document, or throws an error naming the line', () => {
    const tally = { read: 0, refused: 0 };
    const mark = fc.constantFrom('\u2028', '\u2029', '\u0085', '\v', '\f');
    fc.assert(fc.property(anyText, fc.array(fc.tuple(fc.nat(), mark), { minLength: 1, maxLength: 3 }), (text, marks) => {
      const { head, body } = split(text);
      const at = body.join('\n');
      let out = at;
      for (const [k, m] of marks) {
        const i = at.length === 0 ? 0 : k % at.length;
        out = out.slice(0, i) + m + out.slice(i);
      }
      const r = outcome(() => read([...head, out].join('\n')));
      if ('error' in r) {
        tally.refused++;
        expect(r.error).toMatch(/^Mermaid, line \d+: /);
      } else {
        tally.read++;
      }
    }), RUNS);
    expect(tally.read).toBeGreaterThan(0);
  }, TIMEOUT);
});
