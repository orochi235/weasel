/** A gantt compiled to its marks: a row per task under its section, each task a span on a time axis. */
import { axisMarks, axisRoom } from '../axes';
import { CHART_PAD as PAD, chartTitle } from '../chartTitle';
import { spanMark } from '../marks/boxes';
import { areaMark, ruleMark } from '../marks/paths';
import { textMark } from '../marks/text';
import type { PlotMark } from '../marks/types';
import type { PlotMeasure } from '../measure';
import { timeScale, type TimeScale } from '../scales/time';
import { seriesColor, type PlotTheme } from '../theme';
import { formatHasHours, strftime } from './dates';
import { DAY, dateFormatOf, scheduleGantt, type GanttSchedule } from './schedule';
import type { GanttData, GanttTag } from './types';

/** Where a gantt's parts landed: the plot area, its time scale, and every task's resolved span. */
export interface GanttLayout {
  /** The area the rows are drawn in, right of the section names and above the axis. */
  plot: { x: number; y: number; width: number; height: number };
  time: TimeScale;
  schedule: GanttSchedule;
  /** What a drag snaps to, in milliseconds: an hour when the `dateFormat` carries hours, else a day. */
  snap: number;
}

const ROW_MAX = 32;
const BAR = 0.7;
const GAP = 8;
const LABEL_GAP = 4;

/** A time scale over `domain` whose labels read in strftime `axisFormat`, when one is given. */
export function ganttTimeScale(domain: readonly [number, number], range: readonly [number, number], axisFormat?: string): TimeScale {
  const scale = timeScale({ domain, range });
  return axisFormat ? { ...scale, format: (v: number) => strftime(v, axisFormat) } : scale;
}

/** The fill a task's tags give it: critical in the fourth series color (faded when also done), done in the axis
 *  color, active in the second series color, else the first. */
export function ganttTaskFill(tags: readonly GanttTag[] | undefined, theme: PlotTheme): { color: string; opacity?: number } {
  const done = tags?.includes('done') ?? false;
  if (tags?.includes('crit')) return { color: seriesColor(theme, 3), ...(done ? { opacity: 0.5 } : {}) };
  if (done) return { color: theme.axis };
  if (tags?.includes('active')) return { color: seriesColor(theme, 1) };
  return { color: seriesColor(theme, 0) };
}

/** The today line's color and width: the `todayMarker` style's `stroke` and `stroke-width` where it gives them. */
function todayStroke(style: string | undefined, theme: PlotTheme): { color: string; width: number } {
  const color = /(?:^|[;,])\s*stroke\s*:\s*([^;,]+)/.exec(style ?? '')?.[1]?.trim();
  const width = Number(/stroke-width\s*:\s*([\d.]+)/.exec(style ?? '')?.[1]);
  return { color: color || seriesColor(theme, 9), width: Number.isFinite(width) && width > 0 ? width : 2 };
}

/** Lays out a gantt in a box of `size`: its title, section bands and names, task spans and names, axis, and today. */
export function compileGantt(
  data: GanttData, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure,
): { marks: PlotMark[]; layout: GanttLayout } {
  const { marks, top } = chartTitle(data.title, size.width, theme, measure);
  const schedule = scheduleGantt(data);
  const names = data.sections.map((s) => s.name ?? '');
  const sectionWidth = names.some((n) => n !== '') ? Math.max(...names.map((n) => measure(n, theme.font).width)) + 2 * GAP : 0;
  const left = PAD + sectionWidth;
  const right = Math.max(left + 1, size.width - PAD);
  const axis = { theme, measure, side: 'bottom' as const };
  const room = axisRoom({ ...axis, scale: ganttTimeScale(schedule.domain, [0, 1], data.axisFormat), at: 0 });
  const rows = data.sections.reduce((n, s) => n + s.tasks.length, 0);
  const avail = Math.max(1, size.height - PAD - room - top);
  const rowHeight = rows === 0 ? 0 : Math.min(ROW_MAX, avail / rows);
  const bottom = top + (rows === 0 ? avail : rowHeight * rows);
  const time = ganttTimeScale(schedule.domain, [left, right], data.axisFormat);
  const layout: GanttLayout = {
    plot: { x: left, y: top, width: right - left, height: bottom - top },
    time, schedule, snap: formatHasHours(dateFormatOf(data)) ? DAY / 24 : DAY,
  };
  let row = 0;
  data.sections.forEach((section, s) => {
    const y = top + row * rowHeight;
    const height = section.tasks.length * rowHeight;
    row += section.tasks.length;
    if (height === 0) return;
    marks.push(spanMark({ key: `section:${s}:band`, x0: PAD, x1: right, y, height, color: theme.grid, opacity: s % 2 === 0 ? 0.45 : 0.2, datum: { section: s } }));
    if (section.name) {
      marks.push(textMark({
        key: `section:${s}:label`, text: section.name, x: PAD + GAP, y: y + height / 2, anchor: 'start', font: theme.font, color: theme.text,
        measure, bold: true, datum: { edit: 'section', section: s },
      }));
    }
  });
  marks.push(...axisMarks({ ...axis, key: 'axis:time', scale: time, at: bottom, gridTo: top }));
  const today = Date.now();
  const [d0, d1] = schedule.domain;
  if (data.todayMarker?.trim() !== 'off' && today >= d0 && today <= d1) {
    const x = time.map(today);
    marks.push(ruleMark({ key: 'today', from: { x, y: top }, to: { x, y: bottom }, ...todayStroke(data.todayMarker, theme) }));
  }
  marks.push(...taskMarks(data, layout, rowHeight, theme, measure));
  return { marks, layout };
}

/** Every task's span (a diamond for a milestone) and its name: inside the bar where it fits, else beside it. */
function taskMarks(data: GanttData, layout: GanttLayout, rowHeight: number, theme: PlotTheme, measure: PlotMeasure): PlotMark[] {
  const { time, plot } = layout;
  const barHeight = rowHeight * BAR;
  const marks: PlotMark[] = [];
  const labels: PlotMark[] = [];
  let row = 0;
  data.sections.forEach((section, s) => section.tasks.forEach((task, t) => {
    const span = layout.schedule.spans[s]![t]!;
    const cy = plot.y + (row++ + 0.5) * rowHeight;
    const fill = ganttTaskFill(task.tags, theme);
    const datum = { section: s, task: t };
    const key = `task:${s}:${t}`;
    let x0 = time.map(span.start);
    let x1 = time.map(span.end);
    if (task.tags?.includes('milestone')) {
      const r = barHeight / 2;
      const points = [{ x: x0 - r, y: cy }, { x: x0, y: cy - r }, { x: x0 + r, y: cy }, { x: x0, y: cy + r }];
      marks.push(areaMark({ key, top: points, bottom: [], color: fill.color, opacity: fill.opacity ?? 1, datum }));
      [x0, x1] = [x0 - r, x0 + r];
    } else {
      marks.push(spanMark({ key, x0, x1, y: cy - barHeight / 2, height: barHeight, ...fill, datum }));
    }
    const width = measure(task.name, theme.font).width;
    const inside = !task.tags?.includes('milestone') && width + 2 * LABEL_GAP <= x1 - x0;
    const after = x1 + LABEL_GAP + width <= plot.x + plot.width;
    const [x, anchor] = inside ? [(x0 + x1) / 2, 'middle' as const] : after ? [x1 + LABEL_GAP, 'start' as const] : [x0 - LABEL_GAP, 'end' as const];
    labels.push(textMark({
      key: `${key}:label`, text: task.name, x, y: cy, anchor, font: theme.font, color: theme.text, measure,
      datum: { edit: 'task', section: s, task: t },
    }));
  }));
  return [...marks, ...labels];
}
