/** Renders `BASELINE.md`'s per-file sections, and merges one run's files into a baseline. */
import { readBenchReport, type BenchRow, type VitestJsonReport } from './vitest-bench.ts';

/** ms, rendered at a precision that stays readable across six orders of magnitude. */
export function ms(v: number): string {
  if (v >= 100) return v.toFixed(0);
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(4);
  return v.toExponential(2);
}

/** One `## <suite>` section per bench file, in row order. */
export function renderSections(rows: BenchRow[]): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let lines: string[] = [];
  let currentGroup: string | null = null;
  rows.forEach((r, n) => {
    if (!sections.has(r.suite)) {
      lines = [`## ${r.suite}`, ''];
      sections.set(r.suite, lines);
      currentGroup = null;
    }
    if (r.group !== currentGroup) {
      currentGroup = r.group;
      lines.push(`### ${r.group}`, '');
      lines.push('| benchmark | median (ms) | min (ms) | ops/sec | rme | samples |');
      lines.push('|---|---:|---:|---:|---:|---:|');
    }
    lines.push(
      `| ${r.name} | ${ms(r.median)} | ${ms(r.min)} | ` +
      `${Math.round(r.hz).toLocaleString('en-US')} | ±${r.rme.toFixed(1)}% | ${r.samples} |`,
    );
    if (rows[n + 1]?.group !== r.group || rows[n + 1]?.suite !== r.suite) lines.push('');
  });
  return sections;
}

const suiteOfResult = (r: VitestJsonReport['testResults'][number]) =>
  readBenchReport({ testResults: [r] })[0]?.suite ?? r.name;

/**
 * `base` with every bench file `add` measured replaced by `add`'s copy, in place; files
 * `base` lacks are appended. Returns the merged report and the suites it took from `add`.
 */
export function mergeReports<R extends VitestJsonReport>(base: R, add: VitestJsonReport) {
  const incoming = new Map(add.testResults.map((r) => [suiteOfResult(r), r]));
  const testResults = base.testResults.map((r) => incoming.get(suiteOfResult(r)) ?? r);
  const present = new Set(base.testResults.map(suiteOfResult));
  for (const [suite, r] of incoming) if (!present.has(suite)) testResults.push(r);
  return { report: { ...base, testResults } as R, suites: [...incoming.keys()] };
}

/**
 * Replaces each `## <suite>` section of a rendered baseline with `sections`' copy,
 * leaving the header and every other section as they are; a suite the file lacks is appended.
 */
export function spliceSections(md: string, sections: Map<string, string[]>): string {
  // The file is its lines joined plus one newline, and every section ends in a blank line.
  const lines = md.replace(/\n$/, '').split('\n');
  const out: string[] = [];
  const pending = new Map(sections);
  let skipping = false;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      const fresh = pending.get(line.slice(3));
      skipping = fresh !== undefined;
      if (fresh) {
        out.push(...fresh);
        pending.delete(line.slice(3));
        continue;
      }
    }
    if (!skipping) out.push(line);
  }
  for (const fresh of pending.values()) {
    if (out.at(-1) !== '') out.push('');
    out.push(...fresh);
  }
  return `${out.join('\n')}\n`;
}
