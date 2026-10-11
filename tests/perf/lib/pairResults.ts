/**
 * Match the result files of two runs by benchmark, so a whole directory of
 * them can go through `perf:compare` at once.
 */
import type { PerfResult } from './result.ts';

export interface ResultFile<R = PerfResult> {
  path: string;
  result: R;
}

export interface Pairing<R> {
  pairs: Array<{ benchmark: string; a: ResultFile<R>; b: ResultFile<R> }>;
  /** Benchmarks with a result on one side only. */
  onlyA: string[];
  onlyB: string[];
}

function latestByBenchmark<R extends Pick<PerfResult, 'benchmark' | 'timestamp'>>(
  files: ReadonlyArray<ResultFile<R>>,
): Map<string, ResultFile<R>> {
  const latest = new Map<string, ResultFile<R>>();
  for (const f of files) {
    const held = latest.get(f.result.benchmark);
    if (!held || Date.parse(f.result.timestamp) > Date.parse(held.result.timestamp)) {
      latest.set(f.result.benchmark, f);
    }
  }
  return latest;
}

export function pairByBenchmark<R extends Pick<PerfResult, 'benchmark' | 'timestamp'>>(
  a: ReadonlyArray<ResultFile<R>>,
  b: ReadonlyArray<ResultFile<R>>,
): Pairing<R> {
  const la = latestByBenchmark(a);
  const lb = latestByBenchmark(b);
  const names = (m: Map<string, unknown>) => [...m.keys()].sort();
  return {
    pairs: names(la).filter((n) => lb.has(n)).map((n) => ({ benchmark: n, a: la.get(n)!, b: lb.get(n)! })),
    onlyA: names(la).filter((n) => !lb.has(n)),
    onlyB: names(lb).filter((n) => !la.has(n)),
  };
}
