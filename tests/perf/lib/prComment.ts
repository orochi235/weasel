/**
 * The pull request comment `.github/workflows/perf-pr.yml` posts, comparing
 * the base and head revisions' result files. The whole `perf:compare` report
 * runs past half a million characters, so the comment holds the rows that moved
 * most and one line per benchmark; the report itself goes in the job's artifact.
 */
import { type Comparison, type Row, decimalsFor, formatColumn } from './compare.ts';

/** First line of the comment, so a later run finds and rewrites its own. */
export const COMMENT_MARKER = '<!-- weasel-perf-compare -->';

/** GitHub refuses a comment body past 65,536 characters. */
export const MAX_COMMENT_CHARS = 60_000;

/** Rows in the largest-changes table. */
export const TOP_ROWS = 25;

/** A ratio at or past this either way counts as a change in a benchmark's summary line. */
export const CHANGED = 0.1;

export interface BenchmarkComparison {
  benchmark: string;
  cmp: Comparison;
}

export interface CommentInput {
  compared: BenchmarkComparison[];
  /** Benchmarks with a result on one side only. */
  onlyBase: string[];
  onlyHead: string[];
}

/** How far a ratio is from 1, the same either way: 2x and 0.5x score alike. */
const spread = (ratio: number) => Math.abs(Math.log(ratio));

type Ranked = Row & { benchmark: string; ratio: number };

const ranked = (compared: BenchmarkComparison[]): Ranked[] =>
  compared
    .flatMap(({ benchmark, cmp }) => cmp.rows.map((row) => ({ ...row, benchmark })))
    .filter((row): row is Ranked => row.ratio !== null && row.ratio > 0)
    .sort((x, y) => spread(y.ratio) - spread(x.ratio));

/** Lays out cells as columns, padded to their widest; `right` names the columns aligned right. */
function table(header: string[], columns: string[][], right: ReadonlySet<number>): string {
  const widths = header.map((h, c) => Math.max(h.length, ...columns[c].map((cell) => cell.length)));
  const line = (cells: string[]) =>
    cells.map((cell, c) => (right.has(c) ? cell.padStart(widths[c]) : cell.padEnd(widths[c]))).join('  ').trimEnd();
  const rows = columns[0].map((_, r) => line(columns.map((col) => col[r])));
  return [line(header), widths.map((w) => '-'.repeat(w)).join('  '), ...rows].join('\n');
}

const fence = (s: string) => `\`\`\`\n${s}\n\`\`\`\n`;

function largestChanges(rows: Ranked[]): string {
  const top = rows.slice(0, TOP_ROWS);
  const values = top.flatMap((r) => [r.a, r.b]);
  const decimals = decimalsFor(values);
  return table(
    ['ratio', 'benchmark', 'item', 'metric', 'a', 'b', 'unit'],
    [
      formatColumn(top.map((r) => r.ratio), { decimals: 3, suffix: 'x' }),
      top.map((r) => r.benchmark),
      top.map((r) => r.item),
      top.map((r) => r.metric),
      formatColumn(top.map((r) => r.a), { decimals }),
      formatColumn(top.map((r) => r.b), { decimals }),
      top.map((r) => r.unit),
    ],
    new Set([0, 4, 5]),
  );
}

function perBenchmark(compared: BenchmarkComparison[]): string {
  const lines = compared.map(({ benchmark, cmp }) => {
    const rows = ranked([{ benchmark, cmp }]);
    const largest = rows[0];
    return {
      benchmark,
      rows: cmp.rows.length,
      up: rows.filter((r) => r.ratio >= 1 + CHANGED).length,
      down: rows.filter((r) => r.ratio <= 1 - CHANGED).length,
      largest: largest?.ratio ?? null,
      where: largest ? `${largest.item} ${largest.metric}` : '',
    };
  });
  const count = (xs: number[]) => formatColumn(xs, { decimals: 0 });
  const pct = Math.round(CHANGED * 100);
  return table(
    ['benchmark', 'rows', `+${pct}%`, `-${pct}%`, 'largest', 'at'],
    [
      lines.map((l) => l.benchmark),
      count(lines.map((l) => l.rows)),
      count(lines.map((l) => l.up)),
      count(lines.map((l) => l.down)),
      formatColumn(lines.map((l) => l.largest), { decimals: 3, suffix: 'x' }),
      lines.map((l) => l.where),
    ],
    new Set([1, 2, 3, 4]),
  );
}

/** What compare's report shouts about, one line each: a different machine, software GL, a changed unit. */
function warnings(compared: BenchmarkComparison[]): string[] {
  return compared.flatMap(({ benchmark, cmp }) => [
    ...(cmp.fingerprint.length
      ? [`${benchmark}: the two sides ran on different setups (${cmp.fingerprint.map((f) => f.field).join(', ')})`]
      : []),
    ...cmp.loud.map((l) => `${benchmark}: ${l}`),
  ]);
}

export function commentBody(input: CommentInput, shas: { base: string; head: string }): string {
  const out = [
    COMMENT_MARKER,
    '### Benchmarks',
    '',
    `a is the commit this branch forked from, \`${shas.base.slice(0, 10)}\`; b is this pull request, \`${shas.head.slice(0, 10)}\`. ` +
      'Both ran back to back on the same machine. Nothing here gates the build: read a ratio against ' +
      'the spread of its neighbors before believing it (`tests/perf/README.md`).',
    '',
  ];
  const footer = 'The whole report, every row of every benchmark, is `compare.txt` in the job\'s `perf-pr-result-files` artifact.\n';

  if (input.compared.length === 0) {
    out.push('No benchmark wrote a result on both revisions; see the job log.', '');
  } else {
    out.push('**Largest changes**, either way', '', fence(largestChanges(ranked(input.compared))));
    out.push('**Every benchmark**', '', fence(perBenchmark(input.compared)));
    const warned = warnings(input.compared);
    if (warned.length) out.push(...warned.map((w) => `- ${w}`), '');
  }
  if (input.onlyBase.length) out.push(`Only on a: ${input.onlyBase.join(', ')}.`, '');
  if (input.onlyHead.length) out.push(`Only on b: ${input.onlyHead.join(', ')}.`, '');
  out.push(footer);

  const body = out.join('\n');
  if (body.length <= MAX_COMMENT_CHARS) return body;
  const cutNote = '\nThe comment was cut short to fit; the artifact holds everything.\n';
  const cut = body.slice(0, MAX_COMMENT_CHARS - cutNote.length - 4);
  return `${cut.slice(0, cut.lastIndexOf('\n'))}\n${cut.split('```').length % 2 === 0 ? '```\n' : ''}${cutNote}`;
}
