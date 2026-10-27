import { describe, expect, it } from 'vitest';
import type { Comparison, Row } from './compare.ts';
import { COMMENT_MARKER, MAX_COMMENT_CHARS, TOP_ROWS, commentBody } from './prComment.ts';

const shas = { base: 'a'.repeat(40), head: 'b'.repeat(40) };

const row = (item: string, a: number, b: number): Row => ({
  item, metric: 'frame', unit: 'ms', a, b, delta: b - a, ratio: b / a, stat: 'median',
});
const cmp = (rows: Row[], extra: Partial<Comparison> = {}): Comparison =>
  ({ loud: [], notes: [], fingerprint: [], rows, ...extra });

const fenced = (body: string, after: string) => {
  const from = body.indexOf('```\n', body.indexOf(after)) + 4;
  return body.slice(from, body.indexOf('\n```', from)).split('\n');
};

describe('commentBody', () => {
  it('leads with the marker and names both revisions', () => {
    const body = commentBody({ compared: [], onlyBase: [], onlyHead: [] }, shas);
    expect(body.startsWith(COMMENT_MARKER)).toBe(true);
    expect(body).toContain('`aaaaaaaaaa`');
    expect(body).toContain('`bbbbbbbbbb`');
    expect(body).toContain('No benchmark wrote a result');
  });

  it('ranks rows across benchmarks by how far their ratio is from 1, either way', () => {
    const body = commentBody({
      compared: [
        { benchmark: 'flush', cmp: cmp([row('small', 10, 11), row('halved', 10, 5)]) },
        { benchmark: 'draw-loop', cmp: cmp([row('tripled', 1, 3), row('same', 4, 4)]) },
      ],
      onlyBase: [],
      onlyHead: [],
    }, shas);
    const lines = fenced(body, 'Largest changes').slice(2);
    expect(lines.map((l) => l.split(/\s+/).filter(Boolean)[2])).toEqual(['tripled', 'halved', 'small', 'same']);
  });

  it('keeps the top rows only, and one summary line per benchmark', () => {
    const many = Array.from({ length: 200 }, (_, i) => row(`item${i}`, 100, 100 + i));
    const body = commentBody({ compared: [{ benchmark: 'big', cmp: cmp(many) }], onlyBase: [], onlyHead: [] }, shas);
    expect(fenced(body, 'Largest changes')).toHaveLength(TOP_ROWS + 2);
    const summary = fenced(body, 'Every benchmark');
    expect(summary).toHaveLength(3);
    // 190 of the 200 rows grew by 10% or more, none shrank.
    expect(summary[2].split(/\s+/).slice(0, 4)).toEqual(['big', '200', '190', '0']);
    expect(body.length).toBeLessThanOrEqual(MAX_COMMENT_CHARS);
  });

  it('aligns the decimal points of a number column', () => {
    const body = commentBody({
      compared: [{ benchmark: 'b', cmp: cmp([row('x', 1.5, 150), row('y', 20, 2.25)]) }],
      onlyBase: [],
      onlyHead: [],
    }, shas);
    const lines = fenced(body, 'Largest changes').slice(2);
    const dots = lines.map((l) => l.indexOf('x '));
    expect(new Set(dots).size).toBe(1);
  });

  it('names a benchmark whose sides ran on different machines, and those on one side only', () => {
    const body = commentBody({
      compared: [{
        benchmark: 'flush',
        cmp: cmp([row('x', 1, 2)], { fingerprint: [{ field: 'cpu', a: 'M1', b: 'M2' }] }),
      }],
      onlyBase: ['retired'],
      onlyHead: ['added'],
    }, shas);
    expect(body).toContain('flush: the two sides ran on different setups (cpu)');
    expect(body).toContain('Only on a: retired.');
    expect(body).toContain('Only on b: added.');
  });
});
