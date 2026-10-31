/** An xychart compiled to its scales and marks. */
import { axisMarks, axisRoom } from '../axes';
import { barMark, pointMark } from '../marks/boxes';
import { lineMark } from '../marks/paths';
import { textMark } from '../marks/text';
import type { PlotMark } from '../marks/types';
import type { PlotMeasure } from '../measure';
import { bandScale } from '../scales/band';
import { linearScale, niceDomain, type LinearScale } from '../scales/linear';
import type { Scale } from '../scales/types';
import { seriesColor, type PlotTheme } from '../theme';
import type { XyChartData } from './types';

/** Where an xychart's parts landed: the plot area, the value scale, and each value index's place across it. */
export interface XyLayout {
  orientation: 'vertical' | 'horizontal';
  /** The area the marks are drawn in, inside the axes. */
  plot: { x: number; y: number; width: number; height: number };
  /** Values along y for a vertical chart, along x for a horizontal one. */
  value: LinearScale;
  /** Each value index's center along the category axis. */
  slots: readonly number[];
  /** How much of the category axis each index's bars share. */
  slotWidth: number;
}

const PAD = 12;
const GAP = 8;
const BAND_PADDING = 0.2;

/** How many values the longest series holds. */
export const xyLength = (data: XyChartData): number => Math.max(0, ...data.series.map((s) => s.values.length));

/** The labels of the category bands: the axis's own, else numbers from 1. */
function categoriesOf(data: XyChartData): string[] {
  if (data.x?.kind === 'band') return [...data.x.categories];
  return Array.from({ length: xyLength(data) }, (_, i) => String(i + 1));
}

/** The value axis's domain: its own ends, and where one is missing, the values' reach with zero in it, made round. */
export function xyValueDomain(data: XyChartData): [number, number] {
  const values = data.series.flatMap((s) => s.values).filter(Number.isFinite);
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const [niceLo, niceHi] = niceDomain([lo, hi === lo ? lo + 1 : hi]);
  const min = data.y?.min ?? niceLo;
  const max = data.y?.max ?? niceHi;
  return min === max ? [min, min + 1] : [min, max];
}

/** The category axis's scale over `range`, and each value index's center and share along it. */
function categoryAxis(data: XyChartData, range: [number, number]): { scale: Scale<string> | Scale<number>; slots: number[]; slotWidth: number } {
  const n = xyLength(data);
  if (data.x?.kind === 'range') {
    const scale = linearScale({ domain: [data.x.min, data.x.max], range });
    const step = (range[1] - range[0]) / Math.max(1, n);
    const slots = Array.from({ length: n }, (_, i) => range[0] + step * (i + 0.5));
    return { scale, slots, slotWidth: Math.abs(step) * (1 - BAND_PADDING) };
  }
  const categories = categoriesOf(data);
  const scale = bandScale({ domain: categories, range, paddingInner: BAND_PADDING });
  const slots = Array.from({ length: n }, (_, i) => (i < categories.length ? scale.position(categories[i]!) : Number.NaN));
  return { scale, slots, slotWidth: scale.bandwidth };
}

/** Lays out an xychart in a box of `size`: its title, axes, bars, lines and points. */
export function compileXyChart(
  data: XyChartData, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure,
): { marks: PlotMark[]; layout: XyLayout } {
  const vertical = data.orientation !== 'horizontal';
  const marks: PlotMark[] = [];
  let top = PAD;
  if (data.title) {
    const title = textMark({
      key: 'title', text: data.title, x: size.width / 2, y: PAD, baseline: 'top', font: theme.font, color: theme.text, measure, bold: true,
    });
    marks.push(title);
    top += title.pose.height + GAP;
  }
  const domain = xyValueDomain(data);
  const base = { theme, measure, at: 0 };
  const valueTitle = data.y?.title !== undefined ? { title: data.y.title } : {};
  const categoryTitle = data.x?.title !== undefined ? { title: data.x.title } : {};
  const probe = categoryAxis(data, [0, 1]);
  const valueRoom = axisRoom({ ...base, ...valueTitle, scale: linearScale({ domain, range: [0, 1] }), side: vertical ? 'left' : 'bottom' });
  const categoryRoom = axisRoom({ ...base, ...categoryTitle, scale: probe.scale as Scale<unknown>, side: vertical ? 'bottom' : 'left' });
  const left = PAD + (vertical ? valueRoom : categoryRoom);
  const bottom = size.height - PAD - (vertical ? categoryRoom : valueRoom);
  const plot = { x: left, y: top, width: Math.max(1, size.width - PAD - left), height: Math.max(1, bottom - top) };
  const right = plot.x + plot.width;

  const value = linearScale({ domain, range: vertical ? [bottom, top] : [left, right] });
  const category = categoryAxis(data, vertical ? [left, right] : [top, bottom]);
  marks.push(...axisMarks({ ...base, ...valueTitle, key: 'axis:value', scale: value, side: vertical ? 'left' : 'bottom', at: vertical ? left : bottom, gridTo: vertical ? right : top }));
  marks.push(...axisMarks({ ...base, ...categoryTitle, key: 'axis:category', scale: category.scale as Scale<unknown>, side: vertical ? 'bottom' : 'left', at: vertical ? bottom : left }));

  const layout: XyLayout = { orientation: vertical ? 'vertical' : 'horizontal', plot, value, slots: category.slots, slotWidth: category.slotWidth };
  marks.push(...seriesMarks(data, layout, theme));
  return { marks, layout };
}

/** The bars, lines and points of every series, in series order. */
function seriesMarks(data: XyChartData, layout: XyLayout, theme: PlotTheme): PlotMark[] {
  const { value, slots, slotWidth } = layout;
  const vertical = layout.orientation === 'vertical';
  const at = (along: number, v: number) => (vertical ? { x: along, y: value.map(v) } : { x: value.map(v), y: along });
  const [d0, d1] = value.domain;
  const baseline = value.map(Math.min(Math.max(0, Math.min(d0, d1)), Math.max(d0, d1)));
  const bars = data.series.filter((s) => s.kind === 'bar');
  const barWidth = slotWidth / Math.max(1, bars.length);
  const categories = categoriesOf(data);
  const marks: PlotMark[] = [];
  data.series.forEach((series, s) => {
    const color = seriesColor(theme, s);
    const datum = (i: number) => ({ series: s, index: i, value: series.values[i]!, category: categories[i] ?? String(i + 1) });
    const placed = series.values.map((v, i) => ({ v, i })).filter(({ v, i }) => Number.isFinite(v) && Number.isFinite(slots[i] ?? Number.NaN));
    if (series.kind === 'bar') {
      const j = bars.indexOf(series);
      for (const { v, i } of placed) {
        marks.push(barMark({
          key: `bar:${s}:${i}`, x: slots[i]! - slotWidth / 2 + j * barWidth, width: barWidth, from: baseline, to: value.map(v), color,
          datum: datum(i), orient: layout.orientation,
        }));
      }
      return;
    }
    if (placed.length > 0) {
      marks.push(lineMark({ key: `line:${s}`, points: placed.map(({ v, i }) => at(slots[i]!, v)), color, datum: { series: s } }));
    }
    for (const { v, i } of placed) marks.push(pointMark({ key: `point:${s}:${i}`, ...at(slots[i]!, v), radius: 3.5, color, datum: datum(i) }));
  });
  return marks;
}
