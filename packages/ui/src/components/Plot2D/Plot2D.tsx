import type { ColorSource } from '@weasel-js/paint';
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  clientToPlotPoint, modelToPlot, plotToModel,
  type ModelRange, type Point,
} from './geometry';
import type { TickFormatter } from '@weasel-js/scale';
import s from './Plot2D.module.css';
import { dlog } from '../../dlog';
import { resolveTicks, TickLabels, TickLines, useLabelWidth } from './PlotTicks';
import { PlotAxes, PlotGrid } from './PlotFrame';

/** Background grid configuration for a {@link Plot2D}. */
export interface GridSettings {
  /** Number of evenly-spaced internal grid lines per axis (excluding
   *  the edges). Applied to both x and y. Default 3. */
  divisions?: number;
  /** Stroke color override. When omitted, uses `var(--plot-grid)`. */
  color?: ColorSource;
}

/** Axis-line configuration for a {@link Plot2D}. */
export interface AxesSettings {
  /** Stroke color override. When omitted, uses `var(--plot-axis)`. */
  color?: ColorSource;
}

/**
 * Ticks along one axis of a {@link Plot2D}: a line across the plot at each
 * tick value, and a label naming it. Every label in a column is formatted
 * to the same number of decimal places.
 */
export interface TickSettings {
  /** Tick values in model space; any outside the range are skipped.
   *  Omitted = round 1/2/5 steps, as many as `minSpacing` allows at the
   *  plot's current size. */
  values?: readonly number[];
  /** Smallest gap between generated ticks, in px. Default 24 on y, 64 on x. */
  minSpacing?: number;
  /** A generated tick nearer either end of the axis than this is dropped,
   *  so its label stays on the plot, in px. Default 4 on y, 16 on x. */
  inset?: number;
  /** Draw a line across the plot at each tick. Default true. */
  lines?: boolean;
  /** Where labels sit: `'inside'` the plot along its left (y) or bottom (x)
   *  edge, `'outside'` it past that edge in space the caller leaves free,
   *  or `false` for none. Default `'inside'`. */
  labels?: 'inside' | 'outside' | false;
  /** Space between a label and the plot edge it sits against, in px.
   *  Default 4. */
  gap?: number;
  /** Label text for a tick. Default `formatTick` from `@weasel-js/scale`. */
  format?: TickFormatter;
}

/** A pointer position given in both of the plot's coordinate systems. */
export interface Plot2DCoords {
  plot: Point;
  model: Point;
}

/** Props for {@link Plot2D}. */
export interface Plot2DProps {
  width: number;
  height: number;
  /** Model-space x range. Default [0, 1]. */
  xRange?: readonly [number, number];
  /** Model-space y range. Default [0, 1]. */
  yRange?: readonly [number, number];
  /** Background grid. `false` / `null` / omitted = no grid. Pass `{}`
   *  for default (3 divisions per axis) or populated GridSettings. */
  grid?: GridSettings | false | null;
  /** Axis lines. `false` / `null` = no axes. Omitted = default-styled
   *  axes (on). Pass AxesSettings to customize. */
  axes?: AxesSettings | false | null;
  /** Ticks at x values. `false` / `null` / omitted = none; `{}` = defaults. */
  xTicks?: TickSettings | false | null;
  /** Ticks at y values. `false` / `null` / omitted = none; `{}` = defaults. */
  yTicks?: TickSettings | false | null;
  /** Forwarded to the underlying svg. Consumer opts into focus this way. */
  tabIndex?: number;
  /** Default `'img'`. A plot holding focusable marks must not be an image,
   *  whose children are presentational to assistive technology. */
  role?: string;
  'aria-label'?: string;
  /** Forwarded to the svg, for a plot whose marks are held: `aria-disabled` covers every mark inside it. */
  'aria-disabled'?: boolean;
  'aria-describedby'?: string;
  /** Forwarded to the svg, for the stylesheet. */
  'data-held'?: string;
  /** Forwarded to the svg: out of reach, its marks included. */
  inert?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Pointer down on the SVG. Receives both plot- and model-space coords
   *  pre-computed so consumers don't repeat the rect/transform dance. */
  onPointerDown?: (e: ReactPointerEvent<SVGSVGElement>, coords: Plot2DCoords) => void;
  onContextMenu?: (e: ReactMouseEvent<SVGSVGElement>, coords: Plot2DCoords) => void;
  onKeyDown?: (e: ReactKeyboardEvent<SVGSVGElement>) => void;
  children?: ReactNode;
}

/**
 * Imperative handle on a {@link Plot2D}: the SVG element, its size, and the
 * coordinate conversions, including ones that start from a raw DOM event so a
 * drag tracked on `window` can still map back into the plot.
 */
export interface Plot2DHandle {
  readonly svg: SVGSVGElement | null;
  plotToModel(pt: Point): Point;
  modelToPlot(pt: Point): Point;
  /** Convert a DOM event's clientX/clientY (e.g. from a window-attached
   *  pointermove during drag) to plot-space. */
  clientToPlot(e: { clientX: number; clientY: number }): Point;
  /** Convenience: clientToPlot → plotToModel. */
  clientToModel(e: { clientX: number; clientY: number }): Point;
  readonly width: number;
  readonly height: number;
}

// React's SVG attributes leave out `inert`, which every element takes.
const INERT = { inert: true };

/**
 * An SVG plotting surface with an optional grid, axes and ticks. It draws the
 * frame and owns the model-space to plot-space mapping; the plotted content is
 * whatever children are passed, positioned in plot space.
 */
export const Plot2D = forwardRef<Plot2DHandle, Plot2DProps>(function Plot2D(props, ref) {
  const {
    width, height,
    xRange = [0, 1],
    yRange = [0, 1],
    grid, axes, xTicks, yTicks,
    tabIndex,
    role = 'img',
    className, style,
    onPointerDown, onContextMenu, onKeyDown,
    children,
  } = props;

  const svgRef = useRef<SVGSVGElement | null>(null);

  const modelRange: ModelRange = useMemo(
    () => ({ xMin: xRange[0], xMax: xRange[1], yMin: yRange[0], yMax: yRange[1] }),
    [xRange, yRange],
  );

  const plotSize = useMemo(() => ({ width, height }), [width, height]);

  const clientToPlot = useCallback(
    (e: { clientX: number; clientY: number }): Point => clientToPlotPoint(e, svgRef.current?.getBoundingClientRect(), plotSize),
    [plotSize],
  );

  useEffect(() => {
    dlog('plot2d', 'mount', { width, height });
    return () => dlog('plot2d', 'unmount');
    // Mount/unmount trace: re-running on a resize would log a spurious mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useImperativeHandle(ref, () => ({
    get svg() { return svgRef.current; },
    plotToModel: (pt: Point) => plotToModel(pt, modelRange, plotSize),
    modelToPlot: (pt: Point) => modelToPlot(pt, modelRange, plotSize),
    clientToPlot,
    clientToModel: (e) => plotToModel(clientToPlot(e), modelRange, plotSize),
    get width() { return plotSize.width; },
    get height() { return plotSize.height; },
  }), [modelRange, plotSize, clientToPlot]);

  const coordsOf = useCallback((e: { clientX: number; clientY: number }): Plot2DCoords => {
    const plot = clientToPlot(e);
    return { plot, model: plotToModel(plot, modelRange, plotSize) };
  }, [clientToPlot, modelRange, plotSize]);

  const xTickList = xTicks
    ? resolveTicks(xTicks, 'x', xRange, width, (v) => modelToPlot({ x: v, y: yRange[0] }, modelRange, plotSize).x)
    : [];
  const yTickList = yTicks
    ? resolveTicks(yTicks, 'y', yRange, height, (v) => modelToPlot({ x: xRange[0], y: v }, modelRange, plotSize).y)
    : [];

  const yLabelsRef = useRef<SVGGElement | null>(null);
  const yLabelWidth = useLabelWidth(yLabelsRef, !!yTicks && (yTicks.labels ?? 'inside') === 'inside', yTickList);
  const cls = [s.root, className].filter(Boolean).join(' ');

  return (
    <svg
      ref={svgRef}
      className={cls}
      style={style}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={role}
      aria-label={props['aria-label']}
      aria-disabled={props['aria-disabled']}
      aria-describedby={props['aria-describedby']}
      data-held={props['data-held']}
      {...(props.inert ? INERT : undefined)}
      tabIndex={tabIndex}
      onPointerDown={onPointerDown ? (e) => onPointerDown(e, coordsOf(e)) : undefined}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, coordsOf(e)) : undefined}
      onKeyDown={onKeyDown}
    >
      {grid && <PlotGrid grid={grid} width={width} height={height} />}
      <TickLines axis="x" list={xTickList} settings={xTicks} width={width} height={height} />
      <TickLines axis="y" list={yTickList} settings={yTicks} width={width} height={height} />
      {axes !== false && axes !== null && <PlotAxes axes={axes} width={width} height={height} />}
      <TickLabels axis="x" list={xTickList} settings={xTicks} width={width} height={height} yLabelWidth={yLabelWidth} />
      <TickLabels
        axis="y" list={yTickList} settings={yTicks} width={width} height={height} yLabelWidth={yLabelWidth} groupRef={yLabelsRef}
      />
      {children}
    </svg>
  );
});
