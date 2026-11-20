/** Axes as marks: a rule along a scale's range, a tick and a label at each of its ticks, grid lines, a title. */
import { maxOf } from '@weasel-js/geom';
import { ruleMark } from './marks/paths';
import { textMark } from './marks/text';
import type { PlotMark } from './marks/types';
import type { PlotMeasure } from './measure';
import type { Scale } from '@weasel-js/scale';
import type { PlotTheme } from './theme';

/** Which side of the plot an axis runs along. Its scale's range runs along x for top and bottom, along y otherwise. */
export type AxisSide = 'top' | 'bottom' | 'left' | 'right';

/** Options for {@link axisMarks} and {@link axisRoom}. */
export interface AxisOptions<T> {
  scale: Scale<T>;
  side: AxisSide;
  /** Where the axis line stands across its scale: a y for top and bottom, an x for left and right. */
  at: number;
  /** Draw a grid line at each tick, from the axis across to here. */
  gridTo?: number;
  title?: string;
  /** How many ticks to ask the scale for. */
  ticks?: number;
  /** Prefixes every mark's key. Default `axis:<side>`. */
  key?: string;
  theme: PlotTheme;
  measure: PlotMeasure;
}

const TICK = 5;
const GAP = 4;

const isHorizontal = (side: AxisSide) => side === 'top' || side === 'bottom';
/** Which way leads away from the plot across the axis. */
const outward = (side: AxisSide) => (side === 'bottom' || side === 'right' ? 1 : -1);

/** One tick of an axis: its value, where that stands along the scale's range, and how it is written. */
export interface AxisTick<T> {
  value: T;
  position: number;
  label: string;
}

/** The ticks an axis asks `scale` for, placed and written: what any renderer draws an axis from, in whatever space it
 *  lays the scale's range. */
export function axisTicks<T>({ scale, ticks }: Pick<AxisOptions<T>, 'scale' | 'ticks'>): AxisTick<T>[] {
  const write = scale.tickFormat?.(ticks) ?? ((value: T) => scale.format(value));
  return scale.ticks(ticks).map((value) => ({ value, position: scale.position(value), label: write(value) }));
}

/** How far an axis reaches out from its line: ticks, labels and title. */
export function axisRoom<T>(opts: AxisOptions<T>): number {
  const { side, theme, measure } = opts;
  const sizes = axisTicks(opts).map((t) => measure(t.label, theme.font));
  const labels = sizes.length === 0 ? 0 : maxOf(sizes, (s) => (isHorizontal(side) ? s.height : s.width));
  const title = opts.title ? measure(opts.title, theme.font).height + GAP : 0;
  return TICK + GAP + labels + title;
}

/** Every mark one axis is drawn with, in 2D, from {@link axisTicks}. Keys: `<key>:rule`, `<key>:tick:<i>`,
 *  `<key>:label:<i>`, `<key>:grid:<i>`, `<key>:title`. */
export function axisMarks<T>(opts: AxisOptions<T>): PlotMark[] {
  const { scale, side, at, theme, measure } = opts;
  const key = opts.key ?? `axis:${side}`;
  const h = isHorizontal(side);
  const out = outward(side);
  const pt = (along: number, across: number) => (h ? { x: along, y: across } : { x: across, y: along });
  const [r0, r1] = scale.range;
  const marks: PlotMark[] = [];
  const ticks = axisTicks(opts);
  if (opts.gridTo !== undefined) {
    const gridTo = opts.gridTo;
    ticks.forEach(({ position: p }, i) => {
      marks.push(ruleMark({ key: `${key}:grid:${i}`, from: pt(p, at), to: pt(p, gridTo), color: theme.grid }));
    });
  }
  marks.push(ruleMark({ key: `${key}:rule`, from: pt(r0, at), to: pt(r1, at), color: theme.axis }));
  let reach = 0;
  ticks.forEach(({ position: p, label: text }, i) => {
    marks.push(ruleMark({ key: `${key}:tick:${i}`, from: pt(p, at), to: pt(p, at + out * TICK), color: theme.axis }));
    const anchorAt = pt(p, at + out * (TICK + GAP));
    const label = textMark({
      key: `${key}:label:${i}`, text, ...anchorAt, font: theme.font, color: theme.text, measure,
      anchor: h ? 'middle' : out > 0 ? 'start' : 'end',
      baseline: h ? (out > 0 ? 'top' : 'bottom') : 'middle',
    });
    reach = Math.max(reach, h ? label.pose.height : label.pose.width);
    marks.push(label);
  });
  if (opts.title) {
    const across = at + out * (TICK + GAP + reach + GAP);
    marks.push(textMark({
      key: `${key}:title`, text: opts.title, ...pt((r0 + r1) / 2, across), font: theme.font, color: theme.text, measure,
      anchor: 'middle', baseline: out > 0 ? 'top' : 'bottom', vertical: !h,
    }));
  }
  return marks;
}
