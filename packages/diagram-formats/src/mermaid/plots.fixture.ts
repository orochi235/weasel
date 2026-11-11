/**
 * fast-check arbitraries for Mermaid's charts past pie, sankey, and timeline, shared by its property tests. Test-only:
 * nothing in the package imports it.
 */
import fc from 'fast-check';
import type {
  GanttData, GitGraphData, JourneyData, PacketData, PlotData, QuadrantData, RadarData, XyChartData,
} from '@weasel-js/plot';
import { brokenText, oddText } from '../pbt.fixture';

/** Words a chart kind reads as a statement, a comment, or an escape where a line opens with them. */
const CHART_WORDS = ['title', 'title x', 'section', 'section x', '%%', '%% x', '#58;', '#35;', 'dateFormat', 'axis', 'curve', 'commit',
  'x-axis', 'quadrant-1', 'classDef', 'excludes', 'bar', 'line', 'showLegend', 'accTitle: x', 'tag:', '"'];

/** Text that may break across lines, as a title or a name might after a paste, or open with a chart's keyword. */
export const chartText = fc.oneof(
  { weight: 3, arbitrary: oddText }, { weight: 1, arbitrary: brokenText },
  { weight: 1, arbitrary: fc.tuple(fc.constantFrom(...CHART_WORDS), oddText).map(([w, t]) => w + t) },
);
const named = chartText.filter((t) => t.trim() !== '');
const title = fc.option(chartText, { nil: undefined });
const amount = fc.oneof(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -100_000, max: 100_000 }).map((n) => n / 100));
const unit = fc.integer({ min: 0, max: 100 }).map((n) => n / 100);

export const xychart: fc.Arbitrary<XyChartData> = fc.record({
  title, horizontal: fc.boolean(),
  x: fc.option(fc.oneof(
    fc.record({ title: fc.option(chartText, { nil: undefined }), categories: fc.array(chartText, { maxLength: 4 }) })
      .map(({ title: t, categories }) => ({ kind: 'band' as const, ...(t !== undefined ? { title: t } : {}), categories })),
    fc.record({ min: amount, max: amount }).map(({ min, max }) => ({ kind: 'range' as const, min, max })),
  ), { nil: undefined }),
  series: fc.array(fc.record({ kind: fc.constantFrom('bar' as const, 'line' as const), name: fc.option(chartText, { nil: undefined }), values: fc.array(amount, { maxLength: 5 }) }), { maxLength: 3 }),
}).map(({ title: t, horizontal, x, series }) => ({
  kind: 'xychart', ...(t !== undefined ? { title: t } : {}), ...(horizontal ? { orientation: 'horizontal' as const } : {}),
  ...(x !== undefined ? { x } : {}),
  series: series.map((s) => ({ kind: s.kind, values: s.values, ...(s.name !== undefined ? { name: s.name } : {}) })),
}));

export const quadrant: fc.Arbitrary<QuadrantData> = fc.record({
  title,
  x: fc.option(fc.record({ low: named, high: fc.option(named, { nil: undefined }) }), { nil: undefined }),
  quadrants: fc.option(fc.tuple(named, named, named, named), { nil: undefined }),
  points: fc.array(fc.record({ name: named, x: unit, y: unit }), { maxLength: 4 }),
}).map(({ title: t, x, quadrants, points }) => ({
  kind: 'quadrant', ...(t !== undefined ? { title: t } : {}),
  ...(x !== undefined ? { x: { low: x.low, ...(x.high !== undefined ? { high: x.high } : {}) } } : {}),
  ...(quadrants !== undefined ? { quadrants } : {}), points,
}));

export const radar: fc.Arbitrary<RadarData> = fc.integer({ min: 1, max: 5 }).chain((n) => fc.record({
  title,
  axes: fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9_]{0,4}$/), { minLength: n, maxLength: n }),
  labels: fc.array(fc.option(chartText, { nil: undefined }), { minLength: n, maxLength: n }),
  curves: fc.uniqueArray(fc.record({ id: fc.stringMatching(/^[A-Z][a-z]{0,4}$/), label: fc.option(chartText, { nil: undefined }), values: fc.array(unit.map((u) => u * 10), { minLength: n, maxLength: n }) }),
    { selector: (c) => c.id, maxLength: 3 }),
})).map(({ title: t, axes, labels, curves }) => ({
  kind: 'radar', ...(t !== undefined ? { title: t } : {}),
  axes: axes.map((id, i) => ({ id, ...(labels[i] !== undefined ? { label: labels[i] } : {}) })),
  curves: curves.map((c) => ({ id: c.id, values: c.values, ...(c.label !== undefined ? { label: c.label } : {}) })),
}));

export const journey: fc.Arbitrary<JourneyData> = fc.record({
  title,
  sections: fc.array(fc.record({
    name: named,
    tasks: fc.array(fc.record({ name: named, score: fc.integer({ min: 1, max: 5 }), actors: fc.array(named, { maxLength: 3 }) }), { maxLength: 3 }),
  }), { minLength: 1, maxLength: 3 }),
}).map(({ title: t, sections }) => ({ kind: 'journey', ...(t !== undefined ? { title: t } : {}), sections }));

export const packet: fc.Arbitrary<PacketData> = fc.record({
  title,
  widths: fc.array(fc.tuple(fc.integer({ min: 1, max: 16 }), chartText, fc.boolean()), { maxLength: 5 }),
}).map(({ title: t, widths }) => {
  let at = 0;
  const fields = widths.map(([w, label, relative]) => {
    const f = { start: at, end: at + w - 1, label, ...(relative ? { relative } : {}) };
    at += w;
    return f;
  });
  return { kind: 'packet', ...(t !== undefined ? { title: t } : {}), fields };
});

export const gitgraph: fc.Arbitrary<GitGraphData> = fc.record({
  title,
  commits: fc.array(fc.record({ message: fc.option(chartText, { nil: undefined }), tag: fc.option(named, { nil: undefined }) }), { minLength: 1, maxLength: 4 }),
}).map(({ title: t, commits }) => ({
  kind: 'gitgraph', ...(t !== undefined ? { title: t } : {}),
  commands: commits.map((c, i) => ({
    kind: 'commit' as const, id: `c${i}`, ...(c.message !== undefined ? { message: c.message } : {}), ...(c.tag !== undefined ? { tag: c.tag } : {}),
  })),
}));

export const gantt: fc.Arbitrary<GanttData> = fc.record({
  title,
  sections: fc.array(fc.record({
    name: named,
    tasks: fc.array(fc.record({ name: named, days: fc.integer({ min: 1, max: 9 }) }), { minLength: 1, maxLength: 3 }),
  }), { minLength: 1, maxLength: 3 }),
}).map(({ title: t, sections }) => ({
  kind: 'gantt', dateFormat: 'YYYY-MM-DD', ...(t !== undefined ? { title: t } : {}),
  sections: sections.map((s) => ({
    name: s.name,
    tasks: s.tasks.map((k) => ({ name: k.name, start: { kind: 'date' as const, date: '2024-01-01' }, end: { kind: 'duration' as const, amount: k.days, unit: 'd' as const } })),
  })),
}));

export const CHARTS: Readonly<Record<string, fc.Arbitrary<PlotData>>> = { xychart, quadrant, radar, journey, packet, gitgraph, gantt };
