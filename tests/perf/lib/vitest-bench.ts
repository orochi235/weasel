/** Reads a vitest benchmark report, and folds one into a perf run. */
import { relative } from 'node:path';
import { REPO_ROOT, metric, type PerfRun } from './result.ts';

/** One benchmark, flattened out of either report shape. Times in ms. */
export interface BenchRow {
  /** Repo-relative path of the `.bench.ts` file. */
  suite: string;
  group: string;
  name: string;
  median: number;
  min: number;
  mean: number;
  /** Relative margin of error on the mean, in percent. */
  rme: number;
  hz: number;
  samples: number;
}

interface BenchStats {
  p50: number; min: number; mean: number; rme: number; samplesCount: number;
}

/** vitest 5's `--reporter=json`: benchmarks ride on the test that ran them. */
export interface VitestJsonReport {
  testResults: Array<{
    name: string;
    assertionResults: Array<{
      benchmarks?: Array<{
        name: string;
        tasks: Array<{ name: string; latency: BenchStats; throughput: { mean: number } }>;
      }>;
    }>;
  }>;
}

/** vitest 4's `vitest bench --outputJson`, which `bench/baseline.json` was recorded in. */
export interface LegacyBenchReport {
  files: Array<{
    filepath: string;
    groups: Array<{
      fullName: string;
      benchmarks: Array<{
        name: string; median: number; min: number; mean: number; rme: number; hz?: number; sampleCount: number;
      }>;
    }>;
  }>;
}

export type VitestBenchReport = VitestJsonReport | LegacyBenchReport;

// A path absolute to another checkout keeps its repo-relative tail.
function suiteOf(filepath: string): string {
  const rel = relative(REPO_ROOT, filepath);
  return rel.startsWith('..') ? rel.replace(/^.*?(tests\/)/, '$1') : rel;
}

export function readBenchReport(report: VitestBenchReport): BenchRow[] {
  const rows: BenchRow[] = [];
  if ('files' in report) {
    for (const file of report.files) {
      const suite = suiteOf(file.filepath);
      for (const g of file.groups) {
        const group = g.fullName.replace(/^.*?\.bench\.ts > /, '');
        for (const b of g.benchmarks) {
          rows.push({
            suite, group, name: b.name, median: b.median, min: b.min, mean: b.mean,
            rme: b.rme, hz: b.hz ?? 1000 / b.mean, samples: b.sampleCount,
          });
        }
      }
    }
    return rows;
  }
  for (const file of report.testResults) {
    const suite = suiteOf(file.name);
    for (const t of file.assertionResults) {
      for (const g of t.benchmarks ?? []) {
        for (const task of g.tasks) {
          const l = task.latency;
          rows.push({
            suite, group: g.name, name: task.name, median: l.p50, min: l.min, mean: l.mean,
            rme: l.rme, hz: task.throughput.mean, samples: l.samplesCount,
          });
        }
      }
    }
  }
  return rows;
}

export function addVitestBench(run: PerfRun, report: VitestBenchReport): void {
  for (const b of readBenchReport(report)) {
    const n = b.samples;
    run.item(`${b.suite} > ${b.group} > ${b.name}`, {
      median: metric(b.median, 'ms', `median of ${n} samples`),
      min: metric(b.min, 'ms', `min of ${n} samples`),
      mean: metric(b.mean, 'ms', `mean of ${n} samples`),
      rme: metric(b.rme, '%', 'relative margin of error on the mean'),
    }, { file: b.suite, group: b.group, name: b.name });
  }
}
