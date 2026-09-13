/**
 * Diff two perf results and lay the diff out as an aligned table. The CLI
 * around this is `tests/perf/compare.mjs` (`npm run perf:compare`).
 */
import type { PerfResult } from './result.ts';

/** Machine fields that make two runs comparable. Load average is reported, not matched. */
export const IDENTITY_FIELDS = ['cpu', 'cores', 'os', 'node', 'browser', 'glRenderer'] as const;

export interface Row {
  item: string;
  metric: string;
  unit: string;
  a: number | null;
  b: number | null;
  delta: number | null;
  ratio: number | null;
  stat: string;
}

export interface Comparison {
  loud: string[];
  notes: string[];
  fingerprint: Array<{ field: string; a: unknown; b: unknown }>;
  rows: Row[];
}

export function compareResults(a: PerfResult, b: PerfResult): Comparison {
  const loud: string[] = [];
  const notes: string[] = [];

  if (a.benchmark !== b.benchmark) {
    loud.push(`different benchmarks: a is ${a.benchmark}, b is ${b.benchmark}`);
  }

  const fingerprint = IDENTITY_FIELDS
    .filter((f) => (a.machine[f] ?? null) !== (b.machine[f] ?? null))
    .map((f) => ({ field: f, a: a.machine[f] ?? null, b: b.machine[f] ?? null }));

  for (const [label, r] of [['a', a], ['b', b]] as const) {
    if (r.machine.softwareGl) loud.push(`${label} ran on a software GL backend: ${r.machine.glRenderer}`);
    if (r.git.dirty) notes.push(`${label} was measured on a dirty tree`);
    const load = r.machine.loadavg?.[0];
    if (typeof load === 'number' && load > r.machine.cores / 2) {
      notes.push(`${label} started with load ${load.toFixed(2)} on ${r.machine.cores} cores — the machine was busy`);
    }
  }

  const paramKeys = new Set([...Object.keys(a.params), ...Object.keys(b.params)]);
  const changed = [...paramKeys].filter((k) => JSON.stringify(a.params[k]) !== JSON.stringify(b.params[k]));
  if (changed.length) notes.push(`parameters differ: ${changed.join(', ')}`);

  const rows: Row[] = [];
  const aItems = new Map(a.items.map((it) => [it.id, it]));
  const bItems = new Map(b.items.map((it) => [it.id, it]));
  const ordered = [...aItems.keys(), ...[...bItems.keys()].filter((id) => !aItems.has(id))];

  for (const id of ordered) {
    const ia = aItems.get(id);
    const ib = bItems.get(id);
    const names = [...new Set([...Object.keys(ia?.metrics ?? {}), ...Object.keys(ib?.metrics ?? {})])];
    for (const name of names) {
      const ma = ia?.metrics[name];
      const mb = ib?.metrics[name];
      const unitClash = !!ma && !!mb && ma.unit !== mb.unit;
      if (unitClash) loud.push(`${id} ${name}: unit changed from ${ma.unit} to ${mb.unit}; not diffed`);
      const both = ma && mb && !unitClash ? { ma, mb } : null;
      const stat = ma && mb && ma.stat !== mb.stat ? `${ma.stat} (b: ${mb.stat})` : (ma ?? mb)?.stat ?? '';
      rows.push({
        item: id,
        metric: name,
        unit: unitClash ? `${ma!.unit}/${mb!.unit}` : (ma ?? mb)?.unit ?? '',
        a: ma?.value ?? null,
        b: mb?.value ?? null,
        delta: both ? both.mb.value - both.ma.value : null,
        ratio: both && both.ma.value !== 0 ? both.mb.value / both.ma.value : null,
        stat,
      });
    }
  }

  return { loud, notes, fingerprint, rows };
}

/**
 * Decimal places for a column: enough for three significant digits on its
 * smallest non-zero magnitude, between 2 and 6.
 */
export function decimalsFor(values: Array<number | null>): number {
  const mags = values.filter((v): v is number => v !== null && v !== 0).map(Math.abs);
  if (mags.length === 0) return 2;
  const smallest = Math.min(...mags);
  return Math.min(6, Math.max(2, Math.ceil(-Math.log10(smallest)) + 2));
}

/**
 * One column of numbers as right-aligned strings with the same decimals, so
 * the decimal points line up. Missing values print as an aligned dash.
 */
export function formatColumn(
  values: Array<number | null>,
  { decimals, sign = false, suffix = '' }: { decimals: number; sign?: boolean; suffix?: string },
): string[] {
  const cells = values.map((v) => (v === null ? '—' : `${sign && v >= 0 ? '+' : ''}${v.toFixed(decimals)}${suffix}`));
  const width = Math.max(0, ...cells.map((c) => c.length));
  return cells.map((c) => c.padStart(width));
}

const shortSha = (r: PerfResult) =>
  `${r.git.sha ? r.git.sha.slice(0, 10) : 'no-git'}${r.git.dirty ? ' (dirty)' : ''}`;

/** @param labels  usually the file paths */
export function formatReport(a: PerfResult, b: PerfResult, cmp: Comparison, labels: { a: string; b: string }): string {
  const out: string[] = [];
  out.push(`perf compare — ${a.benchmark === b.benchmark ? a.benchmark : `${a.benchmark} vs ${b.benchmark}`}`);
  for (const [label, r, path] of [['a', a, labels.a], ['b', b, labels.b]] as const) {
    const load = r.machine.loadavg.map((x) => x.toFixed(2)).join(' ');
    out.push(`  ${label}  ${path}  ${shortSha(r)}  ${r.timestamp}  load ${load} on ${r.machine.cores} cores`);
  }
  const m = a.machine;
  out.push(`  on ${[m.cpu, m.os, `node ${m.node}`, m.browser, m.glRenderer].filter(Boolean).join(' · ')}`);
  out.push('');

  if (cmp.fingerprint.length) {
    const bar = '!'.repeat(78);
    out.push(bar);
    out.push('!! FINGERPRINTS DIFFER — these runs are on different setups, so the deltas');
    out.push('!! below compare machines, not code.');
    const w = Math.max(...cmp.fingerprint.map((d) => d.field.length));
    for (const d of cmp.fingerprint) {
      out.push(`!!   ${d.field.padEnd(w)}  a: ${String(d.a)}`);
      out.push(`!!   ${' '.repeat(w)}  b: ${String(d.b)}`);
    }
    out.push(bar);
    out.push('');
  }
  for (const l of cmp.loud) out.push(`!! ${l}`);
  for (const n of cmp.notes) out.push(`note: ${n}`);
  if (cmp.loud.length || cmp.notes.length) out.push('');

  const rows = cmp.rows;
  const valueDecimals = decimalsFor(rows.flatMap((r) => [r.a, r.b]));
  const cols = {
    item: rows.map((r) => r.item),
    metric: rows.map((r) => r.metric),
    unit: rows.map((r) => r.unit),
    a: formatColumn(rows.map((r) => r.a), { decimals: valueDecimals }),
    b: formatColumn(rows.map((r) => r.b), { decimals: valueDecimals }),
    delta: formatColumn(rows.map((r) => r.delta), { decimals: valueDecimals, sign: true }),
    ratio: formatColumn(rows.map((r) => r.ratio), { decimals: 3, suffix: 'x' }),
    stat: rows.map((r) => r.stat),
  };
  type Col = keyof typeof cols;
  const layout: Array<[Col, 'left' | 'right']> = [
    ['item', 'left'], ['metric', 'left'], ['unit', 'left'],
    ['a', 'right'], ['b', 'right'], ['delta', 'right'], ['ratio', 'right'], ['stat', 'left'],
  ];
  const widths = Object.fromEntries(layout.map(([k]) => [k, Math.max(k.length, ...cols[k].map((c) => c.length))])) as Record<Col, number>;
  const cell = (s: string, k: Col, align: 'left' | 'right') =>
    (k === 'stat' ? s : align === 'right' ? s.padStart(widths[k]) : s.padEnd(widths[k]));
  out.push(layout.map(([k, al]) => cell(k, k, al)).join('  ').trimEnd());
  out.push(layout.map(([k]) => '-'.repeat(k === 'stat' ? 4 : widths[k])).join('  '));
  for (let i = 0; i < rows.length; i++) {
    out.push(layout.map(([k, al]) => cell(cols[k][i], k, al)).join('  ').trimEnd());
  }
  out.push('');
  out.push('delta = b - a; ratio = b / a. Nothing here gates anything.');
  return out.join('\n');
}
