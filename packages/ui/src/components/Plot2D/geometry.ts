/**
 * Coordinate transforms (model ↔ plot) for Plot2D. Pure / deterministic —
 * no DOM, no React, no state.
 *
 * Model space: caller-defined xRange × yRange. Y axis goes UP.
 * Plot space: 0..width × 0..height in CSS pixels. Y axis goes DOWN (SVG).
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * The caller-defined extent of model space, the coordinate system a plot's
 * data lives in.
 */
export interface ModelRange {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** The plot's drawing area in CSS pixels. */
export interface PlotSize {
  width: number;
  height: number;
}

/**
 * Maps a model-space point into plot space, flipping the y axis so model y
 * grows upward while SVG y grows downward.
 */
export function modelToPlot(p: Point, m: ModelRange, plot: PlotSize): Point {
  const xFrac = (p.x - m.xMin) / (m.xMax - m.xMin);
  const yFrac = (p.y - m.yMin) / (m.yMax - m.yMin);
  return {
    x: xFrac * plot.width,
    // Invert y so model y=0 sits at plot bottom (SVG y grows downward).
    y: (1 - yFrac) * plot.height,
  };
}

/** The inverse of {@link modelToPlot}. */
export function plotToModel(p: Point, m: ModelRange, plot: PlotSize): Point {
  const xFrac = p.x / plot.width;
  const yFrac = 1 - p.y / plot.height;
  return {
    x: m.xMin + xFrac * (m.xMax - m.xMin),
    y: m.yMin + yFrac * (m.yMax - m.yMin),
  };
}

/** A client point in plot space, given the plot's drawn `rect`: scaled by how its drawn size differs from `plot`'s,
 *  which CSS can make it. A rect with no size, or none, maps unscaled from its origin. */
export function clientToPlotPoint(
  e: { clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number } | undefined,
  plot: PlotSize,
): Point {
  const sx = rect && rect.width > 0 ? plot.width / rect.width : 1;
  const sy = rect && rect.height > 0 ? plot.height / rect.height : 1;
  return { x: (e.clientX - (rect?.left ?? 0)) * sx, y: (e.clientY - (rect?.top ?? 0)) * sy };
}
