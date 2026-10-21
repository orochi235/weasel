import { describe, expect, it } from 'vitest';
import { mergeReports, renderSections, spliceSections } from './benchReport.ts';
import { readBenchReport, type VitestJsonReport } from './vitest-bench.ts';

const task = (name: string, p50: number) => ({
  name,
  latency: { p50, min: p50, mean: p50, rme: 0.5, samplesCount: 100 },
  throughput: { mean: 1000 / p50 },
});
const file = (suite: string, group: string, tasks: Array<[string, number]>) => ({
  name: `/somewhere/else/${suite}`,
  assertionResults: [{ benchmarks: [{ name: group, tasks: tasks.map(([n, v]) => task(n, v)) }] }],
});
const report = (...files: ReturnType<typeof file>[]): VitestJsonReport => ({ testResults: files });

const render = (r: VitestJsonReport, header = '# Baseline\n\nA note.\n\n') =>
  `${header}${[...renderSections(readBenchReport(r)).values()].flat().join('\n')}\n`;

describe('mergeReports', () => {
  it('replaces the files the new run measured, in place, and appends new ones', () => {
    const base = report(
      file('tests/a.bench.ts', 'ga', [['x', 1]]),
      file('tests/b.bench.ts', 'gb', [['y', 2]]),
      file('tests/c.bench.ts', 'gc', [['z', 3]]),
    );
    const add = report(file('tests/b.bench.ts', 'gb', [['y', 9]]), file('tests/d.bench.ts', 'gd', [['w', 4]]));
    const { report: merged, suites } = mergeReports(base, add);
    expect(suites).toEqual(['tests/b.bench.ts', 'tests/d.bench.ts']);
    expect(readBenchReport(merged).map((r) => [r.suite, r.median])).toEqual([
      ['tests/a.bench.ts', 1],
      ['tests/b.bench.ts', 9],
      ['tests/c.bench.ts', 3],
      ['tests/d.bench.ts', 4],
    ]);
  });
});

describe('spliceSections', () => {
  const base = report(
    file('tests/a.bench.ts', 'ga', [['x', 1]]),
    file('tests/b.bench.ts', 'gb', [['y', 2]]),
    file('tests/c.bench.ts', 'gc', [['z', 3]]),
  );

  it('rewrites only the named sections and keeps the hand-written header', () => {
    const add = report(file('tests/b.bench.ts', 'gb', [['y', 9]]));
    const spliced = spliceSections(render(base), renderSections(readBenchReport(add)));
    expect(spliced).toBe(render(mergeReports(base, add).report));
    expect(spliced.startsWith('# Baseline\n\nA note.\n\n## tests/a.bench.ts')).toBe(true);
  });

  it('rewrites the last section without losing the file ending', () => {
    const add = report(file('tests/c.bench.ts', 'gc', [['z', 7]]));
    expect(spliceSections(render(base), renderSections(readBenchReport(add)))).toBe(
      render(mergeReports(base, add).report),
    );
  });

  it('appends a section the file lacks', () => {
    const add = report(file('tests/d.bench.ts', 'gd', [['w', 4]]));
    expect(spliceSections(render(base), renderSections(readBenchReport(add)))).toBe(
      render(mergeReports(base, add).report),
    );
  });

  it('changes nothing when handed the rows already there', () => {
    const md = render(base);
    expect(spliceSections(md, renderSections(readBenchReport(base)))).toBe(md);
  });
});
