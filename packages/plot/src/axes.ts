/** Axes as marks: a rule along a scale's range, a tick and a label at each of its ticks, grid lines, a title. */
import { ruleMark } from './marks/paths';
import { textMark } from './marks/text';
import type { PlotMark } from './marks/types';
import type { PlotMeasure } from './measure';
import type { Scale } from './scales/types';
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

/** How far an axis reaches out from its line: ticks, labels and title. */
export function axisRoom<T>(opts: AxisOptions<T>): number {
  const { scale, side, theme, measure } = opts;
  const sizes = scale.ticks(opts.ticks).map((t) => measure(scale.format(t), theme.font));
  const labels = sizes.length === 0 ? 0 : Math.max(...sizes.map((s) => (isHorizontal(side) ? s.height : s.width)));
  const title = opts.title ? measure(opts.title, theme.font).height + GAP : 0;
  return TICK + GAP + labels + title;
}

/** Every mark one axis is drawn with. Keys: `<key>:rule`, `<key>:tick:<i>`, `<key>:label:<i>`, `<key>:grid:<i>`, `<key>:title`. */
export function axisMarks<T>(opts: AxisOptions<T>): PlotMark[] {
  const { scale, side, at, theme, measure } = opts;
  const key = opts.key ?? `axis:${side}`;
  const h = isHorizontal(side);
  const out = outward(side);
  const pt = (along: number, across: number) => (h ? { x: along, y: across } : { x: across, y: along });
  const [r0, r1] = scale.range;
  const marks: PlotMark[] = [];
  const ticks = scale.ticks(opts.ticks);
  ticks.forEach((t, i) => {
    const p = scale.position(t);
    if (opts.gridTo !== undefined) {
      marks.push(ruleMark({ key: `${key}:grid:${i}`, from: pt(p, at), to: pt(p, opts.gridTo), color: theme.grid }));
    }
  });
  marks.push(ruleMark({ key: `${key}:rule`, from: pt(r0, at), to: pt(r1, at), color: theme.axis }));
  let reach = 0;
  ticks.forEach((t, i) => {
    const p = scale.position(t);
    marks.push(ruleMark({ key: `${key}:tick:${i}`, from: pt(p, at), to: pt(p, at + out * TICK), color: theme.axis }));
    const anchorAt = pt(p, at + out * (TICK + GAP));
    const label = textMark({
      key: `${key}:label:${i}`, text: scale.format(t), ...anchorAt, font: theme.font, color: theme.text, measure,
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
