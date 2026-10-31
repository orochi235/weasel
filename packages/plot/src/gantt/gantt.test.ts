import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handlesOf } from '../editing/editors';
import { PLOT_THEME, seriesColor } from '../theme';
import { compileGantt } from './compile';
import { formatGanttDate, formatHasHours, parseGanttDate, strftime } from './dates';
import { moveGanttTask, setGanttEnd, setGanttSectionName, setGanttTaskName } from './edit';
import { ganttEditor } from './editor';
import { addGanttDuration, excludedDays, scheduleGantt } from './schedule';
import type { GanttData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const SIZE = { width: 800, height: 400 };
const at = (date: string) => Date.parse(`${date}T00:00:00Z`);

// 2026-01-05 is a Monday.
const PLAN: GanttData = {
  kind: 'gantt',
  title: 'Plan',
  dateFormat: 'YYYY-MM-DD',
  excludes: ['weekends'],
  sections: [
    {
      name: 'Design',
      tasks: [
        { name: 'Spec', id: 'a1', tags: ['done'], start: { kind: 'date', date: '2026-01-05' }, end: { kind: 'duration', amount: 5, unit: 'd' } },
        { name: 'Review', tags: ['active'], start: { kind: 'previous' }, end: { kind: 'duration', amount: 2, unit: 'd' } },
      ],
    },
    {
      name: 'Build',
      tasks: [
        { name: 'Code', id: 'b1', tags: ['crit'], start: { kind: 'after', ids: ['a1'] }, end: { kind: 'date', date: '2026-01-23' } },
        { name: 'Ship', tags: ['milestone'], start: { kind: 'after', ids: ['b1'] }, end: { kind: 'duration', amount: 0, unit: 'd' } },
      ],
    },
  ],
};

const byKey = (data: GanttData) => {
  const { marks, layout } = compileGantt(data, SIZE, PLOT_THEME, measure);
  return { marks, layout, get: (key: string) => marks.find((m) => m.key === key) };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(at('2026-01-14'));
});
afterEach(() => vi.useRealTimers());

describe('gantt dates', () => {
  it('reads and writes Day.js formats strictly, in UTC', () => {
    expect(parseGanttDate('2026-01-05', 'YYYY-MM-DD')).toBe(at('2026-01-05'));
    expect(parseGanttDate('5/1/26 13:30', 'D/M/YY HH:mm')).toBe(Date.UTC(2026, 0, 5, 13, 30));
    expect(parseGanttDate('1767571200', 'X')).toBe(at('2026-01-05'));
    expect(parseGanttDate('day 05 of 2026-01', '[day] DD [of] YYYY-MM')).toBe(at('2026-01-05'));
    expect(parseGanttDate('2026-02-30', 'YYYY-MM-DD')).toBeNull();
    expect(parseGanttDate('2026-1-5', 'YYYY-MM-DD')).toBeNull();
    expect(formatGanttDate(Date.UTC(2026, 0, 5, 9, 5, 7, 12), 'YYYY.MM.DD [at] H:mm:ss.SSS')).toBe('2026.01.05 at 9:05:07.012');
    expect(formatGanttDate(at('2026-01-05'), 'x')).toBe(String(at('2026-01-05')));
    expect(formatHasHours('YYYY-MM-DD')).toBe(false);
    expect(formatHasHours('YYYY-MM-DD HH:mm')).toBe(true);
  });

  it('writes strftime axis labels', () => {
    const t = Date.UTC(2026, 1, 3, 15, 4, 9);
    expect(strftime(t, '%Y %y %m %d %e %b %B %a %A')).toBe('2026 26 02 03  3 Feb February Tue Tuesday');
    expect(strftime(t, '%H %I %M %S %p %j %% %Q')).toBe('15 03 04 09 PM 034 % %Q');
  });
});

describe('scheduleGantt', () => {
  it('follows the task before, `after` and `until`, and counts days past excluded ones', () => {
    const { spans, domain } = scheduleGantt(PLAN);
    expect(spans[0]).toEqual([{ start: at('2026-01-05'), end: at('2026-01-10') }, { start: at('2026-01-10'), end: at('2026-01-14') }]);
    expect(spans[1]).toEqual([{ start: at('2026-01-10'), end: at('2026-01-23') }, { start: at('2026-01-23'), end: at('2026-01-23') }]);
    expect(domain).toEqual([at('2026-01-05'), at('2026-01-23')]);
    const until: GanttData = { ...PLAN, sections: [{ tasks: [...PLAN.sections[0]!.tasks, { name: 'Gap', start: { kind: 'date', date: '2026-01-01' }, end: { kind: 'until', ids: ['a1'] } }] }] };
    expect(scheduleGantt(until).spans[0]![2]).toEqual({ start: at('2026-01-01'), end: at('2026-01-05') });
  });

  it('resolves unknown ids, unreadable dates and cycles to the first date without hanging', () => {
    const odd: GanttData = {
      kind: 'gantt',
      sections: [{
        tasks: [
          { name: 'A', id: 'a', start: { kind: 'after', ids: ['b'] }, end: { kind: 'duration', amount: 1, unit: 'd' } },
          { name: 'B', id: 'b', start: { kind: 'after', ids: ['a'] }, end: { kind: 'duration', amount: 1, unit: 'd' } },
          { name: 'C', start: { kind: 'after', ids: ['nobody'] }, end: { kind: 'date', date: 'soon' } },
          { name: 'D', start: { kind: 'date', date: '2026-03-01' }, end: { kind: 'duration', amount: 2, unit: 'w' } },
        ],
      }],
    };
    const [a, b, c, d] = scheduleGantt(odd).spans[0]!;
    expect(c).toEqual({ start: at('2026-03-01'), end: at('2026-03-01') });
    expect(d).toEqual({ start: at('2026-03-01'), end: at('2026-03-15') });
    for (const s of [a!, b!]) expect(s.end).toBeGreaterThanOrEqual(s.start);
    expect(scheduleGantt({ kind: 'gantt', sections: [] }).domain).toEqual([at('2026-01-14'), at('2026-01-15')]);
  });

  it('excludes weekdays and dates, and adds every unit', () => {
    const excluded = excludedDays({ kind: 'gantt', excludes: ['Friday', '2026-01-06'], sections: [] });
    expect(excluded(at('2026-01-09'))).toBe(true);
    expect(excluded(at('2026-01-06'))).toBe(true);
    expect(excluded(at('2026-01-10'))).toBe(false);
    const none = () => false;
    expect(addGanttDuration(at('2026-01-05'), 1.5, 'h', none)).toBe(at('2026-01-05') + 5_400_000);
    expect(addGanttDuration(at('2026-01-31'), 1, 'M', none)).toBe(at('2026-03-03'));
    expect(addGanttDuration(at('2026-01-05'), 1, 'y', none)).toBe(at('2027-01-05'));
    expect(addGanttDuration(at('2026-01-05'), 100, 'ms', none)).toBe(at('2026-01-05') + 100);
  });
});

describe('compileGantt', () => {
  it('draws a span per task on the time scale, colored by its tags, keeping section and task', () => {
    const { layout, get } = byKey(PLAN);
    const spec = get('task:0:0')!;
    expect(spec.data.plotMark).toEqual({ kind: 'span', datum: { section: 0, task: 0 } });
    expect(spec.pose.x).toBeCloseTo(layout.time.map(at('2026-01-05')));
    expect(spec.pose.x + spec.pose.width).toBeCloseTo(layout.time.map(at('2026-01-10')));
    expect(spec.data.fill?.paint.color).toBe(PLOT_THEME.axis);
    expect(get('task:0:1')!.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 1));
    expect(get('task:1:0')!.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 3));
    expect(get('task:0:1')!.pose.y).toBeGreaterThan(spec.pose.y);
  });

  it('draws a milestone as a diamond at its start', () => {
    const { layout, get } = byKey(PLAN);
    const ship = get('task:1:1')!;
    expect(ship.data.plotMark).toEqual({ kind: 'area', datum: { section: 1, task: 1 } });
    expect(ship.pose.x + ship.pose.width / 2).toBeCloseTo(layout.time.map(at('2026-01-23')));
    expect(ship.pose.width).toBeCloseTo(ship.pose.height);
  });

  it('names sections at left over alternating bands, and tasks on or beside their bars', () => {
    const { layout, get } = byKey(PLAN);
    const design = get('section:0:label')!;
    expect(design.data).toMatchObject({ text: 'Design', plotMark: { datum: { edit: 'section', section: 0 } } });
    expect(design.pose.x + design.pose.width).toBeLessThan(layout.plot.x);
    const bands = [get('section:0:band')!, get('section:1:band')!];
    expect(bands[0]!.data.fill?.paint.opacity).not.toBe(bands[1]!.data.fill?.paint.opacity);
    expect(bands[1]!.pose.y).toBeCloseTo(bands[0]!.pose.y + bands[0]!.pose.height);
    const code = get('task:1:0:label')!;
    expect(code.data.plotMark.datum).toEqual({ edit: 'task', section: 1, task: 0 });
    const bar = get('task:1:0')!;
    expect(code.pose.x).toBeGreaterThan(bar.pose.x);
    expect(code.pose.x + code.pose.width).toBeLessThan(bar.pose.x + bar.pose.width);
    const ship = get('task:1:1:label')!;
    expect(ship.pose.x + ship.pose.width).toBeLessThanOrEqual(get('task:1:1')!.pose.x);
  });

  it('labels the axis through axisFormat, and draws today inside the domain unless it is off', () => {
    const { layout, get } = byKey({ ...PLAN, axisFormat: '%d %b' });
    expect(get('axis:time:label:0')!.data.text).toMatch(/^\d\d [A-Z][a-z]{2}$/);
    const today = get('today')!;
    expect(today.pose.x).toBeCloseTo(layout.time.map(at('2026-01-14')));
    expect(today.data.stroke?.paint.color).toBe(seriesColor(PLOT_THEME, 9));
    expect(byKey({ ...PLAN, todayMarker: 'off' }).get('today')).toBeUndefined();
    expect(byKey({ ...PLAN, todayMarker: 'stroke-width:5px,stroke:#0f0,opacity:0.5' }).get('today')!.data.stroke).toMatchObject({ paint: { color: '#0f0' }, width: 5 });
    vi.setSystemTime(at('2027-01-01'));
    expect(byKey(PLAN).get('today')).toBeUndefined();
  });

  it('keeps every key unique, and does not throw on empty data or a tiny box', () => {
    const { marks } = byKey(PLAN);
    expect(new Set(marks.map((m) => m.key)).size).toBe(marks.length);
    expect(() => compileGantt({ kind: 'gantt', sections: [] }, SIZE, PLOT_THEME, measure)).not.toThrow();
    expect(() => compileGantt(PLAN, { width: 3, height: 3 }, PLOT_THEME, measure)).not.toThrow();
  });
});

describe('gantt edits', () => {
  it('moves a task onto a date, leaving any dependency', () => {
    const moved = moveGanttTask(PLAN, 1, 0, at('2026-01-12'));
    expect(moved.sections[1]!.tasks[0]!.start).toEqual({ kind: 'date', date: '2026-01-12' });
    expect(scheduleGantt(moved).spans[1]![1]!.start).toBe(at('2026-01-23'));
    expect(moveGanttTask(PLAN, 0, 0, at('2026-01-05'))).toBe(PLAN);
    expect(() => moveGanttTask(PLAN, 0, 5, 0)).toThrow(/no task 5 in section 0/);
  });

  it('ends a task in whole units of its duration, counting past excluded days', () => {
    const review = setGanttEnd(PLAN, 0, 1, at('2026-01-16'));
    expect(review.sections[0]!.tasks[1]!.end).toEqual({ kind: 'duration', amount: 4, unit: 'd' });
    expect(scheduleGantt(review).spans[0]![1]!.end).toBe(at('2026-01-16'));
    expect(setGanttEnd(PLAN, 0, 1, at('2026-01-10')).sections[0]!.tasks[1]!.end).toEqual({ kind: 'duration', amount: 1, unit: 'd' });
    expect(setGanttEnd(PLAN, 1, 1, at('2026-01-20')).sections[1]!.tasks[1]!.end).toMatchObject({ amount: 0 });
    expect(setGanttEnd(PLAN, 0, 1, at('2026-01-14'))).toBe(PLAN);
  });

  it('sets a date end, not before the start, and turns an until end into days', () => {
    expect(setGanttEnd(PLAN, 1, 0, at('2026-01-30')).sections[1]!.tasks[0]!.end).toEqual({ kind: 'date', date: '2026-01-30' });
    expect(setGanttEnd(PLAN, 1, 0, at('2026-01-01')).sections[1]!.tasks[0]!.end).toEqual({ kind: 'date', date: '2026-01-10' });
    const until: GanttData = { kind: 'gantt', sections: [{ tasks: [{ name: 'T', start: { kind: 'date', date: '2026-01-05' }, end: { kind: 'until', ids: ['x'] } }] }] };
    expect(setGanttEnd(until, 0, 0, at('2026-01-08')).sections[0]!.tasks[0]!.end).toEqual({ kind: 'duration', amount: 3, unit: 'd' });
  });

  it('renames sections and tasks, an empty name changing nothing', () => {
    expect(setGanttSectionName(PLAN, 1, 'Make').sections[1]!.name).toBe('Make');
    expect(setGanttTaskName(PLAN, 0, 0, ' Write ').sections[0]!.tasks[0]!.name).toBe('Write');
    expect(setGanttTaskName(PLAN, 0, 0, '')).toBe(PLAN);
  });
});

describe('the gantt editor', () => {
  it('puts a move box and an end handle on a bar, and only a move box on a milestone', () => {
    const { get } = byKey(PLAN);
    const bar = get('task:0:1')!;
    const [move, end] = handlesOf(ganttEditor.handle(PLAN, { trait: bar.data.plotMark, pose: bar.pose }));
    expect(move).toMatchObject({ part: 'move', cursor: 'move', box: bar.pose, at: { x: bar.pose.x } });
    expect(end).toMatchObject({ part: 'end', cursor: 'ew-resize', at: { x: bar.pose.x + bar.pose.width } });
    const ship = get('task:1:1')!;
    expect(handlesOf(ganttEditor.handle(PLAN, { trait: ship.data.plotMark, pose: ship.pose })).map((h) => h.part)).toEqual(['move']);
    const band = get('section:0:band')!;
    expect(ganttEditor.handle(PLAN, { trait: band.data.plotMark, pose: band.pose })).toBeNull();
  });

  it('drags a start to the nearest day and an end to whole units', () => {
    const { layout, get } = byKey(PLAN);
    const trait = get('task:0:1')!.data.plotMark;
    const move = ganttEditor.drag(PLAN, trait, SIZE, PLOT_THEME, measure, 'move')!;
    expect(move({ x: layout.time.map(at('2026-01-12') + 3_600_000), y: 0 }).sections[0]!.tasks[1]!.start).toEqual({ kind: 'date', date: '2026-01-12' });
    const end = ganttEditor.drag(PLAN, trait, SIZE, PLOT_THEME, measure, 'end')!;
    expect(end({ x: layout.time.map(at('2026-01-16')), y: 0 }).sections[0]!.tasks[1]!.end).toEqual({ kind: 'duration', amount: 4, unit: 'd' });
    expect(ganttEditor.drag(PLAN, trait, SIZE, PLOT_THEME, measure)).toBeNull();
  });

  it('edits the title, section names and task names in place', () => {
    const text = ganttEditor.text!;
    expect(text(PLAN, { edit: 'title' }, 'Roadmap').title).toBe('Roadmap');
    expect(text(PLAN, { edit: 'section', section: 0 }, 'Think').sections[0]!.name).toBe('Think');
    expect(text(PLAN, { edit: 'task', section: 1, task: 1 }, 'Launch').sections[1]!.tasks[1]!.name).toBe('Launch');
    expect(text(PLAN, { edit: 'task', section: 4, task: 0 }, 'x')).toBe(PLAN);
  });
});
