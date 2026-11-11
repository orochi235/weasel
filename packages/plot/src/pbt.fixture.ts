/**
 * fast-check arbitraries shared by plot's property tests: every chart kind's data, drawn from small name pools so
 * collisions happen, and numbers reaching the double range's ends. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { GanttData, GanttEnd, GanttStart, GanttTask } from './gantt/types';
import type { GitCommand, GitGraphData } from './gitgraph/types';
import type { JourneyData } from './journey/types';
import type { PlotMark } from './marks/types';
import type { PacketData } from './packet/types';
import type { PieData } from './pie/types';
import type { PlotData } from './plotData';
import type { QuadrantData } from './quadrant/types';
import type { RadarData } from './radar/types';
import type { SankeyData } from './sankey/types';
import type { TimelineData } from './timeline/types';
import type { XyChartData } from './xychart/types';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** How often each path ran, so a property that exercised nothing fails rather than passes. */
export function tally(): { count(what: string): void; atLeast(what: string, n: number): void } {
  const seen = new Map<string, number>();
  return {
    count(what) { seen.set(what, (seen.get(what) ?? 0) + 1); },
    atLeast(what, n) {
      if ((seen.get(what) ?? 0) < n) throw new Error(`${what} ran ${seen.get(what) ?? 0} times, wanted ${n}: ${JSON.stringify([...seen])}`);
    },
  };
}

/** A fixed-width text measure, as the package's example tests use. */
export const measure = (text: string): { width: number; height: number } => ({ width: text.length * 7, height: 14 });

/** Every non-finite number anywhere under `value`, by its path. */
export function nonFinite(value: unknown, at = ''): string[] {
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [`${at}=${value}`];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => nonFinite(v, `${at}.${k}`));
}

/** Keys `marks` holds more than once. */
export function duplicateKeys(marks: readonly PlotMark[]): string[] {
  const seen = new Set<string>();
  return marks.flatMap((m) => (seen.has(m.key) ? [m.key] : (seen.add(m.key), [])));
}

/** A finite double of any size, weighted toward the ends and the values charts treat specially. */
export const anyFinite = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: -100, max: 100 }) },
  { weight: 3, arbitrary: fc.double({ noNaN: true, noDefaultInfinity: true }) },
  { weight: 1, arbitrary: fc.constantFrom(0, -0, 1, -1, 1e308, -1e308, Number.MAX_VALUE, -Number.MAX_VALUE, 5e-324, 1e-300) },
);

/** Any number a spec could hold, the non-finite ones included. */
export const anyNumber = fc.oneof({ weight: 6, arbitrary: anyFinite }, { weight: 1, arbitrary: fc.constantFrom(Number.NaN, Infinity, -Infinity) });

/** A fixed axis end: small and whole, or any size. */
const end = fc.oneof(fc.integer({ min: -1000, max: 1000 }), anyFinite);

/** A box a chart is laid out in, from nothing to large. */
export const size = fc.record({
  width: fc.oneof(fc.constantFrom(0, 1, 50, 600), fc.integer({ min: 0, max: 2000 })),
  height: fc.oneof(fc.constantFrom(0, 1, 50, 400), fc.integer({ min: 0, max: 2000 })),
});

const name = fc.constantFrom('a', 'b', 'c', 'd', 'e', '', 'Long name here', '1', '__proto__');
const title = fc.option(fc.constantFrom('Title', '', 'A rather long chart title'), { nil: undefined });
const list = <T>(a: fc.Arbitrary<T>, max = 6) => fc.array(a, { maxLength: max });

export const pieData: fc.Arbitrary<PieData> = fc.record({
  kind: fc.constant('pie' as const),
  title,
  showData: fc.option(fc.boolean(), { nil: undefined }),
  slices: list(fc.record({ label: name, value: anyNumber })),
}, { requiredKeys: ['kind', 'slices'] });

export const sankeyData: fc.Arbitrary<SankeyData> = fc.record({
  kind: fc.constant('sankey' as const),
  title,
  links: list(fc.record({ source: name, target: name, value: anyNumber }), 8),
}, { requiredKeys: ['kind', 'links'] });

const xyOf = (y: fc.Arbitrary<XyChartData['y']>, values: fc.Arbitrary<number>): fc.Arbitrary<XyChartData> => fc.record({
  kind: fc.constant('xychart' as const),
  title,
  orientation: fc.option(fc.constantFrom('vertical' as const, 'horizontal' as const), { nil: undefined }),
  x: fc.option(fc.oneof(
    fc.record({ kind: fc.constant('band' as const), categories: list(name) }),
    fc.record({ kind: fc.constant('range' as const), min: anyFinite, max: anyFinite }),
  ), { nil: undefined }),
  y,
  series: list(fc.record({ kind: fc.constantFrom('bar' as const, 'line' as const), values: list(values, 8) }), 4),
}, { requiredKeys: ['kind', 'series'] });

/** Values of any size, on an axis that fits them or against fixed ends they may lie far past. */
export const xyData: fc.Arbitrary<XyChartData> = fc.oneof(
  xyOf(fc.constant(undefined), anyNumber),
  xyOf(fc.record({ min: end, max: end }, { requiredKeys: [] }), anyNumber),
);

const radarOf = (ends: fc.Arbitrary<{ min?: number; max?: number }>, values: fc.Arbitrary<number>): fc.Arbitrary<RadarData> =>
  fc.tuple(fc.integer({ min: 0, max: 6 }), ends).chain(([n, { min, max }]) => fc.record({
    kind: fc.constant('radar' as const),
    title,
    axes: fc.uniqueArray(name, { minLength: n, maxLength: n }).map((ids) => ids.map((id) => ({ id }))),
    curves: list(fc.record({ id: name, values: list(values, 7) }), 3),
    min: fc.constant(min),
    max: fc.constant(max),
    graticule: fc.option(fc.constantFrom('circle' as const, 'polygon' as const), { nil: undefined }),
    ticks: fc.option(fc.oneof(fc.integer({ min: -2, max: 12 }), anyNumber), { nil: undefined }),
    showLegend: fc.option(fc.boolean(), { nil: undefined }),
  }, { requiredKeys: ['kind', 'axes', 'curves', 'min', 'max'] }).map((d) => {
    if (d.min === undefined) delete d.min;
    if (d.max === undefined) delete d.max;
    return d;
  }));

/** Values of any size, out to a rim they set or against a fixed rim they may lie far past. */
export const radarData: fc.Arbitrary<RadarData> = fc.oneof(
  radarOf(fc.record({ min: anyFinite }, { requiredKeys: [] }), anyNumber),
  radarOf(fc.record({ min: end, max: end }, { requiredKeys: [] }), anyNumber),
);

export const quadrantData: fc.Arbitrary<QuadrantData> = fc.record({
  kind: fc.constant('quadrant' as const),
  title,
  x: fc.option(fc.record({ low: name, high: name }, { requiredKeys: [] }), { nil: undefined }),
  y: fc.option(fc.record({ low: name, high: name }, { requiredKeys: [] }), { nil: undefined }),
  points: list(fc.record({
    name,
    x: fc.oneof(fc.double({ min: 0, max: 1, noNaN: true }), anyNumber),
    y: fc.oneof(fc.double({ min: 0, max: 1, noNaN: true }), anyNumber),
    className: fc.option(name, { nil: undefined }),
    style: fc.option(fc.record({
      radius: anyNumber, color: fc.constant('#ff0000'), strokeWidth: anyNumber,
    }, { requiredKeys: [] }), { nil: undefined }),
  }, { requiredKeys: ['name', 'x', 'y'] })),
  classes: fc.option(fc.dictionary(name, fc.record({ radius: anyNumber, strokeWidth: anyNumber }, { requiredKeys: [] }), { maxKeys: 3 }), { nil: undefined }),
}, { requiredKeys: ['kind', 'points'] });

export const journeyData: fc.Arbitrary<JourneyData> = fc.record({
  kind: fc.constant('journey' as const),
  title,
  sections: list(fc.record({
    name: fc.option(name, { nil: undefined }),
    tasks: list(fc.record({ name, score: fc.oneof(fc.integer({ min: 1, max: 5 }), anyNumber), actors: list(name, 4) })),
  }, { requiredKeys: ['tasks'] }), 4),
}, { requiredKeys: ['kind', 'sections'] });

export const timelineData: fc.Arbitrary<TimelineData> = fc.record({
  kind: fc.constant('timeline' as const),
  title,
  sections: list(fc.record({
    name: fc.option(name, { nil: undefined }),
    periods: list(fc.record({ label: name, events: list(name, 4) })),
  }, { requiredKeys: ['periods'] }), 4),
}, { requiredKeys: ['kind', 'sections'] });

export const packetData: fc.Arbitrary<PacketData> = fc.record({
  kind: fc.constant('packet' as const),
  title,
  bitsPerRow: fc.option(fc.oneof(fc.integer({ min: -2, max: 64 }), anyNumber), { nil: undefined }),
  fields: list(fc.record({
    start: fc.oneof(fc.integer({ min: -2, max: 200 }), anyNumber),
    end: fc.oneof(fc.integer({ min: -2, max: 200 }), anyNumber),
    label: name,
    relative: fc.option(fc.boolean(), { nil: undefined }),
  }, { requiredKeys: ['start', 'end', 'label'] }), 8),
}, { requiredKeys: ['kind', 'fields'] });

const branch = fc.constantFrom('main', 'dev', 'feat', 'x');
const commitId = fc.constantFrom('c1', 'c2', 'c3', 'c4');
const commitType = fc.option(fc.constantFrom('NORMAL' as const, 'REVERSE' as const, 'HIGHLIGHT' as const), { nil: undefined });
const gitCommand: fc.Arbitrary<GitCommand> = fc.oneof(
  { weight: 4, arbitrary: fc.record({ kind: fc.constant('commit' as const), id: fc.option(commitId, { nil: undefined }), type: commitType, tag: fc.option(name, { nil: undefined }) }, { requiredKeys: ['kind'] }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('branch' as const), name: branch, order: fc.option(fc.oneof(fc.integer({ min: -3, max: 5 }), anyNumber), { nil: undefined }) }, { requiredKeys: ['kind', 'name'] }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('checkout' as const), name: branch }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('merge' as const), branch, id: fc.option(commitId, { nil: undefined }), type: commitType }, { requiredKeys: ['kind', 'branch'] }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('cherry-pick' as const), id: commitId, parent: fc.option(commitId, { nil: undefined }) }, { requiredKeys: ['kind', 'id'] }) },
);

export const gitData: fc.Arbitrary<GitGraphData> = fc.record({
  kind: fc.constant('gitgraph' as const),
  title,
  orientation: fc.option(fc.constantFrom('LR' as const, 'TB' as const, 'BT' as const), { nil: undefined }),
  mainBranch: fc.option(fc.constantFrom('main', 'dev'), { nil: undefined }),
  commands: list(gitCommand, 14),
}, { requiredKeys: ['kind', 'commands'] });

const taskId = fc.constantFrom('t1', 't2', 't3', 'nope');
/** A date in `YYYY-MM-DD` across a few centuries, sometimes one that does not read. */
export const ganttDate = fc.oneof(
  { weight: 5, arbitrary: fc.date({ min: new Date(Date.UTC(1, 0, 1)), max: new Date(Date.UTC(9999, 11, 31)), noInvalidDate: true }).map((d) => d.toISOString().slice(0, 10)) },
  { weight: 5, arbitrary: fc.integer({ min: 0, max: 60 }).map((k) => new Date(Date.UTC(2024, 0, 1 + k)).toISOString().slice(0, 10)) },
  { weight: 1, arbitrary: fc.constantFrom('2024-02-30', 'garbage', '', '2024-13-01') },
);
const ganttStart = (date: fc.Arbitrary<string>): fc.Arbitrary<GanttStart> => fc.oneof(
  fc.record({ kind: fc.constant('date' as const), date }),
  fc.record({ kind: fc.constant('after' as const), ids: list(taskId, 3) }),
  fc.constant({ kind: 'previous' as const }),
);
const ganttEnd = (date: fc.Arbitrary<string>): fc.Arbitrary<GanttEnd> => fc.oneof(
  fc.record({ kind: fc.constant('date' as const), date }),
  fc.record({
    kind: fc.constant('duration' as const),
    amount: fc.oneof({ weight: 5, arbitrary: fc.integer({ min: 0, max: 30 }) }, { weight: 1, arbitrary: anyNumber }),
    unit: fc.constantFrom('ms' as const, 's' as const, 'm' as const, 'h' as const, 'd' as const, 'w' as const, 'M' as const, 'y' as const),
  }),
  fc.record({ kind: fc.constant('until' as const), ids: list(taskId, 3) }),
);
const ganttTask = (date: fc.Arbitrary<string>): fc.Arbitrary<GanttTask> => fc.record({
  name,
  id: fc.option(taskId, { nil: undefined }),
  tags: fc.option(fc.subarray(['done', 'active', 'crit', 'milestone'] as const), { nil: undefined }),
  start: ganttStart(date),
  end: ganttEnd(date),
}, { requiredKeys: ['name', 'start', 'end'] });

/** Dates as `dateFormat` writes them, with the format that reads them. */
const ganttDates: fc.Arbitrary<{ dateFormat?: string; date: fc.Arbitrary<string> }> = fc.constantFrom(
  { date: ganttDate },
  { dateFormat: 'x', date: fc.oneof(fc.integer({ min: -1e15, max: 1e15 }).map(String), fc.constantFrom('1' + '0'.repeat(25), '-1' + '0'.repeat(25), '9'.repeat(400), '-' + '9'.repeat(400))) },
);

export const ganttData: fc.Arbitrary<GanttData> = ganttDates.chain(({ dateFormat, date }) => fc.record({
  kind: fc.constant('gantt' as const),
  dateFormat: fc.constant(dateFormat),
  title,
  excludes: fc.option(list(fc.constantFrom('weekends', 'sunday', 'friday', '2024-01-03', 'nonsense'), 3), { nil: undefined }),
  axisFormat: fc.option(fc.constantFrom('%Y-%m-%d', '%b %e', '%H:%M'), { nil: undefined }),
  todayMarker: fc.option(fc.constantFrom('off', 'stroke:#f00;stroke-width:5px'), { nil: undefined }),
  sections: list(fc.record({ name: fc.option(name, { nil: undefined }), tasks: list(ganttTask(date), 4) }, { requiredKeys: ['tasks'] }), 3),
}, { requiredKeys: ['kind', 'sections'] }));

/** Any chart's data. */
export const plotData: fc.Arbitrary<PlotData> = fc.oneof(
  pieData, sankeyData, xyData, radarData, quadrantData, journeyData, timelineData, packetData, gitData, ganttData,
);
