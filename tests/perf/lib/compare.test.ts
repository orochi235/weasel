import { describe, expect, it } from 'vitest';
import { compareResults, decimalsFor, formatColumn, formatReport } from './compare.ts';
import { SCHEMA } from './result.ts';

const metal = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Unspecified Version)';

function result(over: {
  machine?: Record<string, unknown>;
  params?: Record<string, unknown>;
  items?: Array<{ id: string; metrics: Record<string, { value: number; unit: string; stat: string }> }>;
  dirty?: boolean;
} = {}) {
  return {
    schema: SCHEMA,
    benchmark: 'draw-loop',
    git: { sha: 'a'.repeat(40), dirty: over.dirty ?? false },
    timestamp: '2026-09-13T21:04:05.123Z',
    machine: {
      glRenderer: metal, softwareGl: false, browser: 'chromium 141.0.0.0', cpu: 'Apple M2 Max',
      cores: 12, os: 'Darwin 25.6.0 arm64', node: 'v26.1.0', loadavg: [1, 1, 1],
      ...over.machine,
    },
    params: over.params ?? { runs: 3 },
    items: over.items ?? [],
  };
}

const ms = (value: number) => ({ value, unit: 'ms', stat: 'median of 3 runs' });

describe('compareResults', () => {
  it('pairs metrics by item id, with b - a and b / a', () => {
    const a = result({ items: [{ id: 'solid n=100', metrics: { perFrame: ms(2) } }] });
    const b = result({ items: [{ id: 'solid n=100', metrics: { perFrame: ms(3) } }] });
    const cmp = compareResults(a, b);
    expect(cmp.rows).toEqual([{
      item: 'solid n=100', metric: 'perFrame', unit: 'ms', a: 2, b: 3, delta: 1, ratio: 1.5, stat: 'median of 3 runs',
    }]);
    expect(cmp.fingerprint).toEqual([]);
    expect(cmp.loud).toEqual([]);
  });

  it('keeps items present on one side only, without a delta', () => {
    const a = result({ items: [{ id: 'x', metrics: { t: ms(1) } }] });
    const b = result({ items: [{ id: 'y', metrics: { t: ms(1) } }] });
    expect(compareResults(a, b).rows.map((r) => [r.item, r.a, r.b, r.delta, r.ratio])).toEqual([
      ['x', 1, null, null, null],
      ['y', null, 1, null, null],
    ]);
  });

  it('lists every fingerprint field that differs, and ignores load average', () => {
    const a = result({ machine: { loadavg: [0.5, 0.5, 0.5] } });
    const b = result({ machine: { glRenderer: 'SwiftShader', softwareGl: true, node: 'v24.0.0', loadavg: [9, 9, 9] } });
    const cmp = compareResults(a, b);
    expect(cmp.fingerprint.map((d) => d.field)).toEqual(['node', 'glRenderer']);
    expect(cmp.loud).toContain('b ran on a software GL backend: SwiftShader');
    expect(cmp.notes).toContain('b started with load 9.00 on 12 cores — the machine was busy');
  });

  it('refuses to diff a metric whose unit changed', () => {
    const a = result({ items: [{ id: 'x', metrics: { t: ms(1) } }] });
    const b = result({ items: [{ id: 'x', metrics: { t: { value: 1000, unit: 'us', stat: 'median of 3 runs' } } }] });
    const cmp = compareResults(a, b);
    expect(cmp.rows[0]).toMatchObject({ unit: 'ms/us', delta: null, ratio: null });
    expect(cmp.loud[0]).toMatch(/unit changed from ms to us/);
  });

  it('notes changed parameters and dirty trees', () => {
    const cmp = compareResults(result({ params: { runs: 3 } }), result({ params: { runs: 1 }, dirty: true }));
    expect(cmp.notes).toEqual(['b was measured on a dirty tree', 'parameters differ: runs']);
  });
});

describe('column formatting', () => {
  it('picks decimals for three significant digits on the smallest value, within 2..6', () => {
    expect(decimalsFor([0.14, 250])).toBe(3);
    expect(decimalsFor([0.0001])).toBe(6);
    expect(decimalsFor([250, 12])).toBe(2);
    expect(decimalsFor([null, 0])).toBe(2);
  });

  it('right-aligns with equal decimals so the points line up', () => {
    const col = formatColumn([1.5, 123.25, null, -0.5], { decimals: 3, sign: true });
    expect(col).toEqual(['  +1.500', '+123.250', '       —', '  -0.500']);
    const points = col.filter((c) => c.includes('.')).map((c) => c.indexOf('.'));
    expect(new Set(points).size).toBe(1);
  });
});

describe('formatReport', () => {
  const items = (v: number) => [
    { id: 'solid n=100', metrics: { perFrame: ms(1.5 * v) } },
    { id: 'solid n=3200', metrics: { perFrame: ms(123.25 * v) } },
  ];

  it('prints an aligned table and no warning for matching fingerprints', () => {
    const a = result({ items: items(1) });
    const b = result({ items: items(2) });
    const text = formatReport(a, b, compareResults(a, b), { a: 'a.json', b: 'b.json' });
    expect(text).not.toMatch(/FINGERPRINTS DIFFER/);
    const lines = text.split('\n').filter((l) => l.startsWith('solid'));
    expect(lines).toHaveLength(2);
    // Every numeric column ends at the same offset on every row.
    const ends = (l: string) => [...l.matchAll(/[-+]?\d+\.\d+x?/g)].map((m) => m.index! + m[0].length);
    expect(ends(lines[0])).toEqual(ends(lines[1]));
    expect(lines[0]).toContain('2.000x');
  });

  it('warns loudly, naming both values, when fingerprints differ', () => {
    const a = result();
    const b = result({ machine: { glRenderer: 'SwiftShader', softwareGl: true } });
    const text = formatReport(a, b, compareResults(a, b), { a: 'a.json', b: 'b.json' });
    expect(text).toMatch(/!! FINGERPRINTS DIFFER/);
    expect(text).toContain(`a: ${metal}`);
    expect(text).toContain('b: SwiftShader');
  });
});
