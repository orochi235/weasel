/** Folds a `vitest bench --outputJson` report into a perf run. */
import { relative } from 'node:path';
import { REPO_ROOT, metric, type PerfRun } from './result.ts';

interface VitestBenchReport {
  files: Array<{
    filepath: string;
    groups: Array<{
      fullName: string;
      benchmarks: Array<{ name: string; median: number; min: number; mean: number; rme: number; sampleCount: number }>;
    }>;
  }>;
}

export function addVitestBench(run: PerfRun, report: VitestBenchReport): void {
  for (const file of report.files) {
    const suite = relative(REPO_ROOT, file.filepath);
    for (const group of file.groups) {
      const groupName = group.fullName.replace(/^.*?\.bench\.ts > /, '');
      for (const b of group.benchmarks) {
        const n = b.sampleCount;
        run.item(`${suite} > ${groupName} > ${b.name}`, {
          median: metric(b.median, 'ms', `median of ${n} samples`),
          min: metric(b.min, 'ms', `min of ${n} samples`),
          mean: metric(b.mean, 'ms', `mean of ${n} samples`),
          rme: metric(b.rme, '%', 'relative margin of error on the mean'),
        }, { file: suite, group: groupName, name: b.name });
      }
    }
  }
}
