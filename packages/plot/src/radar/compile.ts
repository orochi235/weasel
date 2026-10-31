/** A radar compiled to its scales and marks. */
import { CHART_PAD as PAD, chartTitle } from '../chartTitle';
import { pointMark } from '../marks/boxes';
import { areaMark, lineMark, ruleMark } from '../marks/paths';
import { textMark } from '../marks/text';
import type { PlotMark, PlotPoint } from '../marks/types';
import type { PlotMeasure } from '../measure';
import { polarScale, type PolarScale } from '../scales/polar';
import { seriesColor, type PlotTheme } from '../theme';
import type { RadarData } from './types';

/** Where a radar's parts landed: the scale its spokes are drawn on. */
export interface RadarLayout {
  scale: PolarScale;
}

const GAP = 6;
const SWATCH = 10;
const RING_STEPS = 72;

/** The value range a radar spans: its own ends, else 0 out to its largest value. */
export function radarDomain(data: RadarData): [number, number] {
  const values = data.curves.flatMap((c) => c.values).filter(Number.isFinite);
  const min = data.min ?? 0;
  const max = data.max ?? Math.max(min, ...values);
  return max === min ? [min, min + 1] : [min, max];
}

const labelOf = (item: { id: string; label?: string }): string => item.label ?? item.id;

/** The legend down the right edge, and how wide it is. */
function legend(data: RadarData, top: number, width: number, theme: PlotTheme, measure: PlotMeasure): { marks: PlotMark[]; width: number } {
  if (data.showLegend === false || data.curves.length === 0) return { marks: [], width: 0 };
  const sizes = data.curves.map((c) => measure(labelOf(c), theme.font));
  const room = SWATCH + GAP + Math.max(...sizes.map((s) => s.width));
  const x = width - PAD - room;
  const marks: PlotMark[] = [];
  let y = top;
  data.curves.forEach((c, i) => {
    const h = Math.max(SWATCH, sizes[i]!.height);
    const color = seriesColor(theme, i);
    marks.push(pointMark({ key: `legend:${i}:swatch`, x: x + SWATCH / 2, y: y + h / 2, radius: SWATCH / 2, color, datum: { curve: i } }));
    marks.push(textMark({
      key: `legend:${i}:label`, text: labelOf(c), x: x + SWATCH + GAP, y: y + h / 2, anchor: 'start', font: theme.font, color: theme.text,
      measure, datum: { edit: 'curve', curve: i },
    }));
    y += h + GAP;
  });
  return { marks, width: room + GAP };
}

/** Which side of its anchor an axis label at `angle` grows toward, so it reads outward from the rim. */
function labelPlacement(angle: number): { anchor: 'start' | 'middle' | 'end'; baseline: 'top' | 'middle' | 'bottom' } {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  return {
    anchor: s > 0.1 ? 'start' : s < -0.1 ? 'end' : 'middle',
    baseline: c > 0.1 ? 'bottom' : c < -0.1 ? 'top' : 'middle',
  };
}

/** The rings at each tick, the spokes, and the axis labels beyond the rim. */
function graticule(data: RadarData, scale: PolarScale, theme: PlotTheme, measure: PlotMeasure): PlotMark[] {
  const n = data.axes.length;
  const rings = Math.max(1, Math.floor(data.ticks ?? 5));
  const [d0, d1] = scale.domain;
  const { center } = scale;
  const marks: PlotMark[] = [];
  for (let k = 1; k <= rings; k++) {
    const v = d0 + ((d1 - d0) * k) / rings;
    const r = scale.radiusAt(v);
    const points: PlotPoint[] = data.graticule === 'polygon' && n >= 3
      ? Array.from({ length: n + 1 }, (_, i) => scale.point(i % n, v))
      : Array.from({ length: RING_STEPS + 1 }, (_, j) => {
        const a = (2 * Math.PI * j) / RING_STEPS;
        return { x: center.x + r * Math.sin(a), y: center.y - r * Math.cos(a) };
      });
    marks.push(lineMark({ key: `grid:ring:${k}`, points, color: theme.grid, width: 1 }));
  }
  data.axes.forEach((axis, i) => {
    marks.push(ruleMark({ key: `grid:spoke:${i}`, from: scale.point(i, d0), to: scale.point(i, d1), color: theme.axis }));
    const a = scale.angle(i);
    const r = scale.radius[1] + GAP;
    marks.push(textMark({
      key: `axis:${i}:label`, text: labelOf(axis), x: center.x + r * Math.sin(a), y: center.y - r * Math.cos(a),
      ...labelPlacement(a), font: theme.font, color: theme.text, measure, datum: { edit: 'axis', axis: i },
    }));
  });
  return marks;
}

/** Each curve's filled polygon, its outline, and a point on each of its values. */
function curveMarks(data: RadarData, scale: PolarScale, theme: PlotTheme): PlotMark[] {
  const marks: PlotMark[] = [];
  data.curves.forEach((curve, c) => {
    const color = seriesColor(theme, c);
    const placed = data.axes.flatMap((_, i) => {
      const v = curve.values[i];
      return v !== undefined && Number.isFinite(v) ? [{ i, at: scale.point(i, v) }] : [];
    });
    if (placed.length === 0) return;
    const ring = placed.map((p) => p.at);
    marks.push(areaMark({ key: `curve:${c}`, top: ring, color, datum: { curve: c } }));
    marks.push(lineMark({ key: `curve:${c}:outline`, points: [...ring, ring[0]!], color, datum: { curve: c } }));
    for (const { i, at } of placed) marks.push(pointMark({ key: `point:${c}:${i}`, ...at, radius: 3.5, color, datum: { curve: c, axis: i } }));
  });
  return marks;
}

/** Lays out a radar in a box of `size`: its title, graticule, axis labels, curves and legend. */
export function compileRadar(
  data: RadarData, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure,
): { marks: PlotMark[]; layout: RadarLayout } {
  const { marks, top } = chartTitle(data.title, size.width, theme, measure);
  const key = legend(data, top, size.width, theme, measure);
  const labels = data.axes.map((a) => measure(labelOf(a), theme.font));
  const across = GAP + Math.max(0, ...labels.map((l) => l.width));
  const down = GAP + Math.max(0, ...labels.map((l) => l.height));
  const box = { x: PAD, y: top, width: size.width - 2 * PAD - key.width, height: size.height - PAD - top };
  const outer = Math.max(1, Math.min(box.width / 2 - across, box.height / 2 - down));
  const scale = polarScale({
    center: { x: box.x + box.width / 2, y: box.y + box.height / 2 }, radius: [0, outer], domain: radarDomain(data), axes: data.axes.length,
  });
  marks.push(...graticule(data, scale, theme, measure), ...curveMarks(data, scale, theme), ...key.marks);
  return { marks, layout: { scale } };
}
