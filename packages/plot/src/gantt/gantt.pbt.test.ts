/**
 * A gantt's dates and schedule: instants written in a `dateFormat` read back, starts and ends written as text read
 * back, every task scheduled forward inside the chart's domain and chained as written, and every bar drawn inside the
 * plot.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ganttData, measure, runs, tally, timeoutFor } from '../pbt.fixture';
import { PLOT_THEME } from '../theme';
import { compileGantt } from './compile';
import { formatGanttDate, parseGanttDate } from './dates';
import { DAY, addGanttDuration, ganttTasks, scheduleGantt } from './schedule';
import { formatGanttEnd, formatGanttStart, parseGanttEnd, parseGanttStart } from './text';
import type { GanttData, GanttEnd, GanttStart, GanttUnit } from './types';

const RUNS = 300;

/** An instant in years 0 to 9999, as four-digit years write them. */
const instant = fc.integer({ min: Date.UTC(0, 0, 1) - 1900 * 365.2425 * DAY, max: Date.UTC(9999, 11, 31, 23, 59, 59, 999) })
  .filter((t) => new Date(t).getUTCFullYear() >= 0);

const FORMATS: readonly { format: string; resolution: number }[] = [
  { format: 'YYYY-MM-DD', resolution: DAY },
  { format: 'YYYY-MM-DD HH:mm:ss.SSS', resolution: 1 },
  { format: 'DD/MM/YYYY HH:mm', resolution: 60_000 },
  { format: 'YYYY-M-D H:m:s', resolution: 1000 },
  { format: '[day] D [of] M, YYYY', resolution: DAY },
  { format: 'x', resolution: 1 },
  { format: 'X', resolution: 1000 },
];

describe('gantt dates', () => {
  it('reads back what it writes, to the format\'s resolution', () => {
    const seen = tally();
    fc.assert(fc.property(instant, fc.constantFrom(...FORMATS), (t, { format, resolution }) => {
      const at = Math.floor(t / resolution) * resolution;
      const text = formatGanttDate(at, format);
      expect(parseGanttDate(text, format)).toBe(at);
      seen.count(format);
    }), runs(RUNS));
    for (const { format } of FORMATS) seen.atLeast(format, RUNS / 20);
  }, timeoutFor(RUNS, 1));

  it('reads epoch milliseconds of any size a number holds, and refuses the rest', () => {
    fc.assert(fc.property(fc.bigInt({ min: -(10n ** 320n), max: 10n ** 320n }), (n) => {
      const read = parseGanttDate(n.toString(), 'x');
      const value = Number(n);
      expect(read).toBe(Number.isFinite(value) ? value : null);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('gantt start and end text', () => {
  const id = fc.stringMatching(/^[A-Za-z_][\w-]{0,5}$/);
  const unit = fc.constantFrom<GanttUnit>('ms', 's', 'm', 'h', 'd', 'w', 'M', 'y');
  const amount = fc.oneof(fc.integer({ min: 0, max: 1000 }), fc.double({ min: 0, max: 1e6, noNaN: true }), fc.constantFrom(0.5, 1.25, 1e-7, 1e21, 5e-324));
  const start: fc.Arbitrary<GanttStart> = fc.oneof(
    fc.constant({ kind: 'previous' as const }),
    fc.record({ kind: fc.constant('after' as const), ids: fc.array(id, { minLength: 1, maxLength: 3 }) }),
    fc.record({ kind: fc.constant('date' as const), date: fc.constantFrom('2024-01-05', '05/01/2024', '1700000000000') }),
  );
  const end: fc.Arbitrary<GanttEnd> = fc.oneof(
    fc.record({ kind: fc.constant('duration' as const), amount, unit }),
    fc.record({ kind: fc.constant('until' as const), ids: fc.array(id, { minLength: 1, maxLength: 3 }) }),
    fc.record({ kind: fc.constant('date' as const), date: fc.constantFrom('2024-01-05', '05/01/2024', '1700000000000') }),
  );

  it('reads back a start and an end as written', () => {
    const seen = tally();
    fc.assert(fc.property(start, end, (s, e) => {
      expect(parseGanttStart(formatGanttStart(s))).toEqual(s);
      expect(parseGanttEnd(formatGanttEnd(e))).toEqual(e);
      seen.count(e.kind);
    }), runs(RUNS));
    seen.atLeast('duration', RUNS / 5);
  }, timeoutFor(RUNS, 1));
});

describe('scheduleGantt', () => {
  /** The same chart with every link cut: `after` starts become `previous`, `until` ends two hours long. */
  const unlinked = (data: GanttData): GanttData => ({
    ...data,
    sections: data.sections.map((s) => ({
      ...s,
      tasks: s.tasks.map((t) => ({
        ...t,
        start: t.start.kind === 'after' ? { kind: 'previous' as const } : t.start,
        end: t.end.kind === 'until' ? { kind: 'duration' as const, amount: 2, unit: 'h' as const } : t.end,
      })),
    })),
  });

  it('schedules each task forward inside the domain, as its start and end are written', () => {
    const seen = tally();
    fc.assert(fc.property(fc.oneof(ganttData, ganttData.map(unlinked)), (data) => {
      const { spans, domain } = scheduleGantt(data, Date.UTC(2024, 0, 1));
      expect(spans.map((s) => s.length)).toEqual(data.sections.map((s) => s.tasks.length));
      expect(domain[0]).toBeLessThan(domain[1]);
      const flat = spans.flat();
      // Chained only where no task names another, so no dependency cycle runs through the chain.
      const linked = ganttTasks(data).some(({ task }) => task.start.kind === 'after' || task.end.kind === 'until');
      ganttTasks(data).forEach(({ task }, i) => {
        const span = flat[i]!;
        expect(Number.isFinite(span.start) && Number.isFinite(span.end)).toBe(true);
        expect(span.end).toBeGreaterThanOrEqual(span.start);
        expect(span.start).toBeGreaterThanOrEqual(domain[0]);
        expect(span.end).toBeLessThanOrEqual(domain[1]);
        if (task.start.kind === 'previous' && i > 0 && !linked) {
          seen.count('previous');
          expect(span.start).toBe(flat[i - 1]!.end);
        }
        // A start written as a date, so no dependency cycle runs through it.
        if (task.start.kind === 'date' && task.end.kind === 'duration' && task.end.unit === 'h' && Number.isFinite(task.end.amount) && task.end.amount >= 0) {
          seen.count('hours');
          expect(span.end).toBe(addGanttDuration(span.start, task.end.amount, 'h', () => false));
        }
      });
      if (flat.length > 0) seen.count('scheduled');
    }), runs(RUNS));
    seen.atLeast('scheduled', RUNS / 2);
    seen.atLeast('previous', RUNS / 20);
    seen.atLeast('hours', RUNS / 20);
  }, timeoutFor(RUNS, 3));

  it('draws every bar inside the plot, along its span', () => {
    const seen = tally();
    fc.assert(fc.property(ganttData, fc.integer({ min: 0, max: 1500 }), fc.integer({ min: 0, max: 1500 }), (data, width, height) => {
      const { marks, layout } = compileGantt(data, { width, height }, PLOT_THEME, measure);
      const { plot } = layout;
      data.sections.forEach((section, s) => section.tasks.forEach((task, t) => {
        if (task.tags?.includes('milestone')) return;
        const bar = marks.find((m) => m.key === `task:${s}:${t}`)!;
        seen.count('bar');
        const eps = 1e-6 * Math.max(1, plot.width);
        expect(bar.pose.x).toBeGreaterThanOrEqual(plot.x - eps);
        expect(bar.pose.x + bar.pose.width).toBeLessThanOrEqual(plot.x + plot.width + eps);
        expect(bar.pose.width).toBeGreaterThanOrEqual(0);
      }));
    }), runs(RUNS));
    seen.atLeast('bar', RUNS / 2);
  }, timeoutFor(RUNS, 5));
});
