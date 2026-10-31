/** A quadrant chart compiled to its quadrants, axis labels and points. */
import { CHART_PAD as PAD, chartTitle } from '../chartTitle';
import { pointMark, spanMark } from '../marks/boxes';
import { ruleMark } from '../marks/paths';
import { textMark } from '../marks/text';
import type { PlotDatum, PlotMark, PlotPoint } from '../marks/types';
import type { PlotMeasure } from '../measure';
import { seriesColor, type PlotTheme } from '../theme';
import type { QuadrantData, QuadrantPoint, QuadrantPointStyle } from './types';

/** Where a quadrant chart's unit square landed. */
export interface QuadrantLayout {
  plot: { x: number; y: number; width: number; height: number };
}

const GAP = 6;
const RADIUS = 5;

/** Where `x`, `y` in the unit square stands in the plot, y running up. */
export const quadrantAt = (layout: QuadrantLayout, x: number, y: number): PlotPoint => ({
  x: layout.plot.x + x * layout.plot.width, y: layout.plot.y + (1 - y) * layout.plot.height,
});

/** The point in the unit square under `at`, clamped to it and rounded to hundredths. */
export function quadrantValueAt(layout: QuadrantLayout, at: PlotPoint): { x: number; y: number } {
  const unit = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
  return { x: unit((at.x - layout.plot.x) / layout.plot.width), y: unit(1 - (at.y - layout.plot.y) / layout.plot.height) };
}

/** A point's style: its own fields, then its class's, then the defaults. */
export function quadrantStyleOf(data: QuadrantData, point: QuadrantPoint): QuadrantPointStyle {
  const cls = point.className !== undefined ? data.classes?.[point.className] : undefined;
  return { ...cls, ...point.style };
}

/** The unit square laid out in `size` below `top`, leaving room for the axis labels under and left of it. */
export function quadrantLayout(size: { width: number; height: number }, top: number, theme: PlotTheme, measure: PlotMeasure): QuadrantLayout {
  const line = measure('Mg', theme.font).height;
  const left = PAD + line + GAP;
  const bottom = size.height - PAD - line - GAP;
  return { plot: { x: left, y: top, width: Math.max(1, size.width - PAD - left), height: Math.max(1, bottom - top) } };
}

/** Each quadrant's corner in the unit square, in Mermaid's order: top right, top left, bottom left, bottom right. */
const CORNERS = [[0.5, 1], [0, 1], [0, 0.5], [0.5, 0.5]] as const;

function quadrantMarks(data: QuadrantData, layout: QuadrantLayout, theme: PlotTheme, measure: PlotMeasure): PlotMark[] {
  const marks: PlotMark[] = [];
  const { plot } = layout;
  CORNERS.forEach(([x, y], i) => {
    const corner = quadrantAt(layout, x, y);
    marks.push(spanMark({
      key: `quadrant:${i + 1}`, x0: corner.x, x1: corner.x + plot.width / 2, y: corner.y, height: plot.height / 2,
      color: seriesColor(theme, i), opacity: 0.15, datum: { quadrant: i + 1 },
    }));
  });
  const mid = quadrantAt(layout, 0.5, 0.5);
  marks.push(ruleMark({ key: 'divider:x', from: { x: mid.x, y: plot.y }, to: { x: mid.x, y: plot.y + plot.height }, color: theme.axis }));
  marks.push(ruleMark({ key: 'divider:y', from: { x: plot.x, y: mid.y }, to: { x: plot.x + plot.width, y: mid.y }, color: theme.axis }));
  CORNERS.forEach(([x, y], i) => {
    const text = data.quadrants?.[i];
    if (!text) return;
    const center = quadrantAt(layout, x + 0.25, y - 0.25);
    marks.push(textMark({
      key: `quadrant:label:${i + 1}`, text, ...center, font: theme.font, color: theme.text, measure, bold: true,
      datum: { edit: 'quadrant', quadrant: i + 1 },
    }));
  });
  return marks;
}

/** Each axis's end labels: centered under or beside its half, or the whole axis for a low end alone. */
function axisLabelMarks(data: QuadrantData, layout: QuadrantLayout, theme: PlotTheme, measure: PlotMeasure): PlotMark[] {
  const { plot } = layout;
  const marks: PlotMark[] = [];
  const base = { font: theme.font, color: theme.text, measure };
  for (const axis of ['x', 'y'] as const) {
    const ends = data[axis];
    for (const end of ['low', 'high'] as const) {
      const text = ends?.[end];
      if (!text) continue;
      const along = ends?.high ? (end === 'low' ? 0.25 : 0.75) : 0.5;
      const datum: PlotDatum = { edit: 'axis', axis, end };
      marks.push(axis === 'x'
        ? textMark({ ...base, key: `axis:x:${end}`, text, x: plot.x + along * plot.width, y: plot.y + plot.height + GAP, baseline: 'top', datum })
        : textMark({ ...base, key: `axis:y:${end}`, text, x: plot.x - GAP, y: plot.y + (1 - along) * plot.height, baseline: 'bottom', vertical: true, datum }));
    }
  }
  return marks;
}

function pointMarks(data: QuadrantData, layout: QuadrantLayout, theme: PlotTheme, measure: PlotMeasure): PlotMark[] {
  const marks: PlotMark[] = [];
  data.points.forEach((p, i) => {
    const style = quadrantStyleOf(data, p);
    const at = quadrantAt(layout, p.x, p.y);
    const radius = style.radius ?? RADIUS;
    const mark = pointMark({ key: `point:${i}`, ...at, radius, color: style.color ?? theme.text, datum: { point: i } });
    if (style.strokeColor !== undefined || style.strokeWidth !== undefined) {
      mark.data.stroke = { paint: { color: style.strokeColor ?? theme.text }, width: style.strokeWidth ?? 1 };
    }
    marks.push(mark);
    marks.push(textMark({
      key: `point:label:${i}`, text: p.name, x: at.x + radius + GAP, y: at.y, anchor: 'start', font: theme.font, color: theme.text, measure,
      datum: { edit: 'point', point: i },
    }));
  });
  return marks;
}

/** Lays out a quadrant chart in a box of `size`: its title, the four quadrants and their labels, the axis labels,
 *  and each point with its name beside it. */
export function compileQuadrant(
  data: QuadrantData, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure,
): { marks: PlotMark[]; layout: QuadrantLayout } {
  const { marks, top } = chartTitle(data.title, size.width, theme, measure);
  const layout = quadrantLayout(size, top, theme, measure);
  marks.push(...quadrantMarks(data, layout, theme, measure), ...axisLabelMarks(data, layout, theme, measure), ...pointMarks(data, layout, theme, measure));
  return { marks, layout };
}
