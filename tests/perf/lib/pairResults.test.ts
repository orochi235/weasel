import { describe, expect, it } from 'vitest';
import { pairByBenchmark } from './pairResults.ts';

const file = (benchmark: string, timestamp: string, path = `${benchmark}-${timestamp}.json`) => ({
  path,
  result: { benchmark, timestamp },
});

describe('pairByBenchmark', () => {
  it('pairs the two sides by benchmark id, in name order', () => {
    const { pairs } = pairByBenchmark(
      [file('flush', '2026-10-11T01:00:00Z'), file('draw-loop', '2026-10-11T01:00:00Z')],
      [file('draw-loop', '2026-10-11T02:00:00Z'), file('flush', '2026-10-11T02:00:00Z')],
    );
    expect(pairs.map((p) => [p.benchmark, p.a.result.timestamp, p.b.result.timestamp])).toEqual([
      ['draw-loop', '2026-10-11T01:00:00Z', '2026-10-11T02:00:00Z'],
      ['flush', '2026-10-11T01:00:00Z', '2026-10-11T02:00:00Z'],
    ]);
  });

  it('takes the latest run when a side holds a benchmark more than once', () => {
    const { pairs } = pairByBenchmark(
      [file('flush', '2026-10-11T03:00:00Z', 'new.json'), file('flush', '2026-10-11T01:00:00Z', 'old.json')],
      [file('flush', '2026-10-11T04:00:00Z')],
    );
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a.path).toBe('new.json');
  });

  it('names the benchmarks only one side ran', () => {
    const { pairs, onlyA, onlyB } = pairByBenchmark(
      [file('flush', '2026-10-11T01:00:00Z'), file('retired', '2026-10-11T01:00:00Z')],
      [file('flush', '2026-10-11T02:00:00Z'), file('added', '2026-10-11T02:00:00Z')],
    );
    expect(pairs.map((p) => p.benchmark)).toEqual(['flush']);
    expect(onlyA).toEqual(['retired']);
    expect(onlyB).toEqual(['added']);
  });
});
