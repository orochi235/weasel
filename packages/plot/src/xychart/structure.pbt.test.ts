/**
 * Stateful property test of an xychart's structural edits: rows and series inserted, removed, and moved, categories
 * named, values and kinds set, against a plain table of rows and series. Every step checks the row count, every
 * series' values, the labels, and that the chart compiles to finite geometry.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compilePlot } from '../plotData';
import { measure, nonFinite, runs, tally, timeoutFor } from '../pbt.fixture';
import { PLOT_THEME } from '../theme';
import { setXyValue, xyRows } from './edit';
import {
  insertXyRow, insertXySeries, moveXyRow, moveXySeries, removeXyRow, removeXySeries, setXyCategory, setXySeriesKind,
} from './structure';
import type { XyChartData } from './types';

const RUNS = 150;

interface Model {
  /** Row labels; empty while the rows are numbered. */
  labels: string[];
  /** The row count while numbered: rows exist only in the series then. */
  numbered: number;
  series: { kind: 'bar' | 'line'; values: number[] }[];
}
interface Real { data: XyChartData }

const rowsOf = (m: Model): number => (m.labels.length > 0 ? m.labels.length : m.series.length > 0 ? m.numbered : 0);
const insert = <T>(list: T[], at: number, item: T): T[] => [...list.slice(0, at), item, ...list.slice(at)];
const move = <T>(list: T[], from: number, to: number): T[] => {
  const out = list.filter((_, i) => i !== from);
  return insert(out, to, list[from]!);
};

const seen = tally();

function check(m: Model, r: Real): void {
  const n = rowsOf(m);
  expect(xyRows(r.data)).toBe(n);
  expect(r.data.series.map((s) => s.kind)).toEqual(m.series.map((s) => s.kind));
  r.data.series.forEach((s, i) => {
    expect(Array.from({ length: n }, (_, k) => s.values[k] ?? 0)).toEqual(m.series[i]!.values);
  });
  const categories = r.data.x?.kind === 'band' ? r.data.x.categories : [];
  expect(categories).toEqual(m.labels);
  const marks = compilePlot(r.data, { width: 600, height: 400 }, PLOT_THEME, measure);
  expect(marks.flatMap((mk) => nonFinite(mk, mk.key))).toEqual([]);
  expect(marks.filter((mk) => mk.key.startsWith('bar:')).length)
    .toBe(m.series.reduce((a, s) => a + (s.kind === 'bar' ? s.values.length : 0), 0));
}

/** A model edit that knows its own preconditions, run against the real chart and checked after. */
const cmd = (name: string, ok: (m: Readonly<Model>) => boolean, model: (m: Model) => void, real: (d: XyChartData) => XyChartData): fc.Command<Model, Real> => ({
  check: ok,
  run(m, r) {
    model(m);
    r.data = real(r.data);
    seen.count(name.split('(')[0]!);
    check(m, r);
  },
  toString: () => name,
});

const label = fc.constantFrom('a', 'b', 'Category 2', '3');
const index = fc.oneof(fc.constant(0), fc.nat(1), fc.nat(2), fc.nat(5));

const commands = [
  fc.tuple(index, fc.option(label, { nil: undefined })).map(([at, name]) => cmd(`insertRow(${at}, ${name})`,
    (m) => at <= rowsOf(m),
    (m) => {
      const n = rowsOf(m);
      if (m.labels.length > 0) {
        const fresh = (() => { let k = n + 1; while (m.labels.includes(`Category ${k}`)) k++; return `Category ${k}`; })();
        m.labels = insert(m.labels, at, name ?? fresh);
      }
      if (m.series.length > 0) m.numbered = n + 1;
      for (const s of m.series) s.values = insert(s.values, at, 0);
    },
    (d) => insertXyRow(d, at, name))),
  index.map((at) => cmd(`removeRow(${at})`,
    (m) => at < rowsOf(m),
    (m) => {
      m.numbered = rowsOf(m) - 1;
      m.labels = m.labels.filter((_, i) => i !== at);
      for (const s of m.series) s.values = s.values.filter((_, i) => i !== at);
    },
    (d) => removeXyRow(d, at))),
  fc.tuple(index, index).map(([from, to]) => cmd(`moveRow(${from}, ${to})`,
    (m) => from < rowsOf(m) && to < rowsOf(m),
    (m) => {
      if (m.labels.length > 0) m.labels = move(m.labels, from, to);
      for (const s of m.series) s.values = move(s.values, from, to);
    },
    (d) => moveXyRow(d, from, to))),
  fc.tuple(index, label).map(([at, name]) => cmd(`setCategory(${at}, ${name})`,
    (m) => at < rowsOf(m),
    (m) => {
      if (m.labels.length === 0) m.labels = Array.from({ length: rowsOf(m) }, (_, i) => String(i + 1));
      m.labels[at] = name;
    },
    (d) => setXyCategory(d, at, name))),
  index.map((at) => cmd(`insertSeries(${at})`,
    (m) => at <= m.series.length,
    (m) => {
      const n = rowsOf(m);
      m.series = insert(m.series, at, { kind: 'bar', values: Array.from({ length: n }, () => 0) });
      m.numbered = n;
    },
    (d) => insertXySeries(d, at))),
  index.map((at) => cmd(`removeSeries(${at})`,
    (m) => at < m.series.length,
    (m) => { m.series = m.series.filter((_, i) => i !== at); },
    (d) => removeXySeries(d, at))),
  fc.tuple(index, index).map(([from, to]) => cmd(`moveSeries(${from}, ${to})`,
    (m) => from < m.series.length && to < m.series.length,
    (m) => { m.series = move(m.series, from, to); },
    (d) => moveXySeries(d, from, to))),
  fc.tuple(index, index, fc.oneof(fc.integer({ min: -50, max: 50 }), fc.double({ noNaN: true, noDefaultInfinity: true }))).map(([s, at, v]) => cmd(`setValue(${s}, ${at}, ${v})`,
    (m) => s < m.series.length && at < rowsOf(m),
    (m) => { m.series[s]!.values[at] = v; },
    (d) => setXyValue(d, s, at, v))),
  fc.tuple(index, fc.constantFrom('bar' as const, 'line' as const)).map(([s, kind]) => cmd(`setKind(${s}, ${kind})`,
    (m) => s < m.series.length,
    (m) => { m.series[s]!.kind = kind; },
    (d) => setXySeriesKind(d, s, kind))),
];

describe('xychart structure, against a table', () => {
  it('keeps every row, series, value, and label where the edits put them', () => {
    fc.assert(fc.property(fc.commands(commands, { maxCommands: 50, size: 'max' }), (cmds) => {
      fc.modelRun(() => ({ model: { labels: [], numbered: 0, series: [] }, real: { data: { kind: 'xychart', series: [] } } }), cmds);
    }), runs(RUNS));
    for (const name of ['insertRow', 'removeRow', 'moveRow', 'setCategory', 'insertSeries', 'removeSeries', 'moveSeries', 'setValue', 'setKind']) {
      seen.atLeast(name, RUNS / 10);
    }
  }, timeoutFor(RUNS, 30));
});
