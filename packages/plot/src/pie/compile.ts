/** A pie compiled to its slices and legend. */
import { CHART_PAD as PAD, chartTitle } from '../chartTitle';
import { spanMark } from '../marks/boxes';
import { arcMark } from '../marks/paths';
import { textMark } from '../marks/text';
import type { PlotMark, PlotPoint } from '../marks/types';
import type { PlotMeasure } from '../measure';
import { seriesColor, type PlotTheme } from '../theme';
import type { PieData } from './types';

/** Where a pie's parts landed: its center and radius, and each slice's angles, clockwise from twelve o'clock. */
export interface PieLayout {
  center: PlotPoint;
  radius: number;
  /** One per slice; a zero-valued slice's two angles are equal. */
  angles: readonly { start: number; end: number }[];
}

const SWATCH = 12;
const GAP = 6;
const LEGEND_GAP = 16;
const LABEL_RADIUS = 0.75;

/** A slice's share of the whole, as Mermaid writes it: rounded to a whole percent. */
export const piePercent = (value: number, total: number): string => `${total > 0 ? ((value / total) * 100).toFixed(0) : '0'}%`;

/** A slice's value as the legend shows it with `showData`. */
export const pieValueText = (value: number): string => `[${value}]`;

/** Each slice's start and end angle, in order clockwise from twelve o'clock; all zero when nothing has a value. */
export function pieAngles(data: PieData): { start: number; end: number }[] {
  const values = data.slices.map((s) => (Number.isFinite(s.value) && s.value > 0 ? s.value : 0));
  const total = values.reduce((a, b) => a + b, 0);
  let at = 0;
  return values.map((v) => {
    const start = at;
    at += total > 0 ? (v / total) * 2 * Math.PI : 0;
    return { start, end: at };
  });
}

/** The legend: a swatch and a label per slice, and with `showData` its value, which a text edit sets. */
function legendMarks(data: PieData, x: number, midY: number, theme: PlotTheme, measure: PlotMeasure): PlotMark[] {
  const row = measure('Mg', theme.font).height + GAP;
  const top = midY - (row * data.slices.length - GAP) / 2;
  const marks: PlotMark[] = [];
  data.slices.forEach((slice, i) => {
    const y = top + i * row;
    const mid = y + (row - GAP) / 2;
    const base = { font: theme.font, color: theme.text, measure, anchor: 'start', baseline: 'middle' } as const;
    marks.push(spanMark({ key: `legend:swatch:${i}`, x0: x, x1: x + SWATCH, y: mid - SWATCH / 2, height: SWATCH, color: seriesColor(theme, i), datum: { slice: i } }));
    const label = textMark({ ...base, key: `legend:label:${i}`, text: slice.label, x: x + SWATCH + GAP, y: mid, datum: { edit: 'label', slice: i } });
    marks.push(label);
    if (data.showData) {
      marks.push(textMark({
        ...base, key: `legend:value:${i}`, text: pieValueText(slice.value), x: label.pose.x + label.pose.width + GAP, y: mid,
        datum: { edit: 'value', slice: i },
      }));
    }
  });
  return marks;
}

/** How wide the legend is: its swatch, its widest label, and with `showData` its widest value. */
function legendWidth(data: PieData, theme: PlotTheme, measure: PlotMeasure): number {
  if (data.slices.length === 0) return 0;
  const widest = Math.max(...data.slices.map((s) => {
    const label = measure(s.label, theme.font).width;
    return data.showData ? label + GAP + measure(pieValueText(s.value), theme.font).width : label;
  }));
  return SWATCH + GAP + widest;
}

/** Lays out a pie in a box of `size`: its title, a slice per value with its share written on it where it fits, and
 *  a legend at the right. */
export function compilePie(
  data: PieData, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure,
): { marks: PlotMark[]; layout: PieLayout } {
  const { marks, top } = chartTitle(data.title, size.width, theme, measure);
  const legend = legendWidth(data, theme, measure);
  const right = size.width - PAD - (legend > 0 ? legend + LEGEND_GAP : 0);
  const area = { width: Math.max(0, right - PAD), height: Math.max(0, size.height - PAD - top) };
  const center = { x: PAD + area.width / 2, y: top + area.height / 2 };
  const radius = Math.min(area.width, area.height) / 2;
  const angles = pieAngles(data);
  const total = data.slices.reduce((sum, s) => sum + (Number.isFinite(s.value) && s.value > 0 ? s.value : 0), 0);
  data.slices.forEach((slice, i) => {
    const { start, end } = angles[i]!;
    if (end <= start || radius < 1) return;
    marks.push(arcMark({ key: `slice:${i}`, center, innerRadius: 0, outerRadius: radius, startAngle: start, endAngle: end, color: seriesColor(theme, i), datum: { slice: i } }));
    const text = piePercent(slice.value, total);
    const room = measure(text, theme.font);
    const mid = (start + end) / 2;
    const r = radius * LABEL_RADIUS;
    if ((end - start) * r < room.width + 4 || radius * (1 - LABEL_RADIUS) * 2 < room.height) return;
    marks.push(textMark({
      key: `percent:${i}`, text, x: center.x + r * Math.sin(mid), y: center.y - r * Math.cos(mid), font: theme.font, color: theme.text, measure,
      datum: { slice: i },
    }));
  });
  marks.push(...legendMarks(data, right + (legend > 0 ? LEGEND_GAP : 0), center.y, theme, measure));
  return { marks, layout: { center, radius, angles } };
}
