/** Marks drawn as a path: lines, areas, rules, arcs and ribbons. */
import { boundsOfPath, pathFromD, type Path } from '@weasel-js/geom';
import type { PlotDatum, PlotMark, PlotMarkData, PlotPoint, SolidStroke } from './types';

const n = (v: number) => Number(v.toFixed(3));
const at = (p: PlotPoint) => `${n(p.x)} ${n(p.y)}`;

/** A mark whose pose is its path's box, so the painter draws the path where it was built. */
function pathMark(key: string, path: Path, data: Omit<PlotMarkData, 'path'>): PlotMark {
  const b = boundsOfPath(path);
  return { key, pose: { x: b.x, y: b.y, width: b.width, height: b.height }, data: { ...data, path } };
}

const traitOf = (kind: PlotMarkData['plotMark']['kind'], datum?: PlotDatum) => ({ kind, ...(datum ? { datum } : {}) });

/** Options for {@link lineMark}. */
export interface LineMarkOptions {
  key: string;
  /** At least one. */
  points: readonly PlotPoint[];
  color: string;
  /** Default 2. */
  width?: number;
  dash?: number[];
  datum?: PlotDatum;
}

/** A line through `points`, in order. */
export function lineMark(opts: LineMarkOptions): PlotMark {
  const [first, ...rest] = opts.points;
  if (first === undefined) throw new Error(`lineMark "${opts.key}": no points`);
  const d = `M ${at(first)}${rest.map((p) => ` L ${at(p)}`).join('')}`;
  const stroke: SolidStroke = {
    paint: { color: opts.color }, width: opts.width ?? 2, join: 'round', cap: 'round', ...(opts.dash ? { dash: opts.dash } : {}),
  };
  return pathMark(opts.key, pathFromD(d), { plotMark: traitOf('line', opts.datum), stroke });
}

/** Options for {@link ruleMark}. */
export interface RuleMarkOptions {
  key: string;
  from: PlotPoint;
  to: PlotPoint;
  color: string;
  /** Default 1. */
  width?: number;
  dash?: number[];
  datum?: PlotDatum;
}

/** A straight rule from `from` to `to`: an axis line, a tick, a grid line, a marker. */
export function ruleMark(opts: RuleMarkOptions): PlotMark {
  const stroke: SolidStroke = { paint: { color: opts.color }, width: opts.width ?? 1, cap: 'butt', ...(opts.dash ? { dash: opts.dash } : {}) };
  return pathMark(opts.key, pathFromD(`M ${at(opts.from)} L ${at(opts.to)}`), { plotMark: traitOf('rule', opts.datum), stroke });
}

/** Options for {@link areaMark}. */
export interface AreaMarkOptions {
  key: string;
  /** The upper edge, in order. */
  top: readonly PlotPoint[];
  /** The lower edge, in the same order as `top`. Default a baseline at `baseline` under each top point. */
  bottom?: readonly PlotPoint[];
  baseline?: number;
  color: string;
  /** Default 0.35. */
  opacity?: number;
  datum?: PlotDatum;
}

/** The region between two edges, as an area chart or a radar's polygon fills it. */
export function areaMark(opts: AreaMarkOptions): PlotMark {
  if (opts.top.length === 0) throw new Error(`areaMark "${opts.key}": no points`);
  const bottom = opts.bottom ?? (opts.baseline !== undefined ? opts.top.map((p) => ({ x: p.x, y: opts.baseline! })) : []);
  const ring = [...opts.top, ...[...bottom].reverse()];
  const d = `M ${ring.map(at).join(' L ')} Z`;
  return pathMark(opts.key, pathFromD(d), {
    plotMark: traitOf('area', opts.datum), fill: { paint: { color: opts.color, opacity: opts.opacity ?? 0.35 } },
  });
}

/** Options for {@link arcMark}. */
export interface ArcMarkOptions {
  key: string;
  center: PlotPoint;
  /** 0 for a pie slice. */
  innerRadius: number;
  outerRadius: number;
  /** Radians clockwise from twelve o'clock. */
  startAngle: number;
  endAngle: number;
  color: string;
  datum?: PlotDatum;
}

const polar = (c: PlotPoint, r: number, a: number): PlotPoint => ({ x: c.x + r * Math.sin(a), y: c.y - r * Math.cos(a) });

/** One side of an arc from `a0` to `a1` at radius `r`, as SVG arc commands, in halves past a half turn. */
function arcTo(c: PlotPoint, r: number, a0: number, a1: number): string {
  const sweep = a1 >= a0 ? 1 : 0;
  const mid = (a0 + a1) / 2;
  const to = (a: number) => ` A ${n(r)} ${n(r)} 0 0 ${sweep} ${at(polar(c, r, a))}`;
  return Math.abs(a1 - a0) > Math.PI ? to(mid) + to(a1) : to(a1);
}

/** A slice of a ring, as a pie or a donut is cut. */
export function arcMark(opts: ArcMarkOptions): PlotMark {
  const { center: c, innerRadius: r0, outerRadius: r1, startAngle: a0 } = opts;
  const a1 = Math.abs(opts.endAngle - a0) >= 2 * Math.PI ? a0 + Math.sign(opts.endAngle - a0) * (2 * Math.PI - 1e-6) : opts.endAngle;
  let d = `M ${at(polar(c, r1, a0))}${arcTo(c, r1, a0, a1)}`;
  d += r0 > 0 ? ` L ${at(polar(c, r0, a1))}${arcTo(c, r0, a1, a0)} Z` : ` L ${at(c)} Z`;
  return pathMark(opts.key, pathFromD(d), { plotMark: traitOf('arc', opts.datum), fill: { paint: { color: opts.color } } });
}

/** Options for {@link ribbonMark}. */
export interface RibbonMarkOptions {
  key: string;
  /** The end it leaves: an x, and the span along y it leaves across. */
  from: { x: number; y0: number; y1: number };
  to: { x: number; y0: number; y1: number };
  color: string;
  /** Default 0.45. */
  opacity?: number;
  datum?: PlotDatum;
}

/** A band curving from one span to another, as a flow between two nodes is drawn. */
export function ribbonMark(opts: RibbonMarkOptions): PlotMark {
  const { from: f, to: t } = opts;
  const mx = (f.x + t.x) / 2;
  const d = `M ${n(f.x)} ${n(f.y0)} C ${n(mx)} ${n(f.y0)} ${n(mx)} ${n(t.y0)} ${n(t.x)} ${n(t.y0)}`
    + ` L ${n(t.x)} ${n(t.y1)} C ${n(mx)} ${n(t.y1)} ${n(mx)} ${n(f.y1)} ${n(f.x)} ${n(f.y1)} Z`;
  return pathMark(opts.key, pathFromD(d), {
    plotMark: traitOf('ribbon', opts.datum), fill: { paint: { color: opts.color, opacity: opts.opacity ?? 0.45 } },
  });
}
