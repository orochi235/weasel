/** Marks drawn as a box: bars, spans and points. */
import type { PlotDatum, PlotMark } from './types';

const fillOf = (color: string, opacity?: number) => ({ paint: { color, ...(opacity !== undefined ? { opacity } : {}) } });

/** Options for {@link barMark}. */
export interface BarMarkOptions {
  key: string;
  /** Where the bar stands along the category axis: its left edge, or its top for a horizontal bar. */
  x: number;
  /** The bar's breadth across the category axis. */
  width: number;
  /** The baseline the bar rises from, and the end it reaches, along the value axis. */
  from: number;
  to: number;
  color: string;
  datum?: PlotDatum;
  /** Default `'vertical'`: `x` and `width` run along x. */
  orient?: 'vertical' | 'horizontal';
}

/** A bar from `from` to `to`, either way round. */
export function barMark(opts: BarMarkOptions): PlotMark {
  const lo = Math.min(opts.from, opts.to);
  const length = Math.abs(opts.to - opts.from);
  const pose = opts.orient === 'horizontal'
    ? { x: lo, y: opts.x, width: length, height: opts.width }
    : { x: opts.x, y: lo, width: opts.width, height: length };
  return {
    key: opts.key,
    pose,
    data: { plotMark: { kind: 'bar', ...(opts.datum ? { datum: opts.datum } : {}) }, shape: 'rect', fill: fillOf(opts.color) },
  };
}

/** Options for {@link spanMark}. */
export interface SpanMarkOptions {
  key: string;
  /** Start and end along x. */
  x0: number;
  x1: number;
  /** Its row: top and height. */
  y: number;
  height: number;
  color: string;
  opacity?: number;
  datum?: PlotDatum;
}

/** A span across x, as a task's bar on a timeline is. */
export function spanMark(opts: SpanMarkOptions): PlotMark {
  return {
    key: opts.key,
    pose: { x: Math.min(opts.x0, opts.x1), y: opts.y, width: Math.abs(opts.x1 - opts.x0), height: opts.height },
    data: {
      plotMark: { kind: 'span', ...(opts.datum ? { datum: opts.datum } : {}) },
      shape: 'rect',
      fill: fillOf(opts.color, opts.opacity),
    },
  };
}

/** Options for {@link pointMark}. */
export interface PointMarkOptions {
  key: string;
  x: number;
  y: number;
  /** Default 3. */
  radius?: number;
  color: string;
  datum?: PlotDatum;
}

/** A dot centered on `x`, `y`. */
export function pointMark(opts: PointMarkOptions): PlotMark {
  const r = opts.radius ?? 3;
  return {
    key: opts.key,
    pose: { x: opts.x - r, y: opts.y - r, width: 2 * r, height: 2 * r },
    data: { plotMark: { kind: 'point', ...(opts.datum ? { datum: opts.datum } : {}) }, shape: 'ellipse', fill: fillOf(opts.color) },
  };
}
