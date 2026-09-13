import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  modelToPlot, plotToModel,
  type ModelRange, type Point,
} from './geometry';
import {
  formatTick, niceTicks, tickDecimals,
  type TickFormatCtx, type TickFormatter,
} from './ticks';
import s from './Plot2D.module.css';
import { dlog } from '../../dlog';

/** Background grid configuration for a {@link Plot2D}. */
export interface GridSettings {
  /** Number of evenly-spaced internal grid lines per axis (excluding
   *  the edges). Applied to both x and y. Default 3. */
  divisions?: number;
  /** Stroke color override. When omitted, uses `var(--plot-grid)`. */
  color?: string;
}

/** Axis-line configuration for a {@link Plot2D}. */
export interface AxesSettings {
  /** Stroke color override. When omitted, uses `var(--plot-axis)`. */
  color?: string;
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
  /** Label text for a tick. Default {@link formatTick}. */
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
  className?: string;
  style?: CSSProperties;
  /** Pointer down on the SVG. Receives both plot- and model-space coords
   *  pre-computed so consumers don't repeat the rect/transform dance. */
  onPointerDown?: (e: ReactPointerEvent<SVGSVGElement>, coords: Plot2DCoords) => void;
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

type Axis = 'x' | 'y';

const TICK_SPACING_PX: Record<Axis, number> = { x: 64, y: 24 };
const TICK_INSET_PX: Record<Axis, number> = { x: 16, y: 4 };
const LABEL_GAP_PX = 4;

interface ResolvedTick {
  value: number;
  /** Plot-space position along the axis. */
  at: number;
  label: string;
}

function resolveTicks(
  settings: TickSettings,
  axis: Axis,
  range: readonly [number, number],
  pixels: number,
  toPlot: (v: number) => number,
): ResolvedTick[] {
  let values: number[];
  let ctx: TickFormatCtx;
  if (settings.values) {
    const lo = Math.min(range[0], range[1]);
    const hi = Math.max(range[0], range[1]);
    const eps = (hi - lo) * 1e-9;
    values = settings.values.filter((v) => v >= lo - eps && v <= hi + eps);
    const gaps = values.slice(1).map((v, i) => v - values[i]);
    const even = gaps.length > 0 && gaps.every((g) => Math.abs(g - gaps[0]) <= Math.abs(gaps[0]) * 1e-9);
    ctx = { decimals: tickDecimals(values), step: even ? gaps[0] : 0 };
  } else {
    const set = niceTicks(range, pixels, {
      minSpacing: settings.minSpacing ?? TICK_SPACING_PX[axis],
      inset: settings.inset ?? TICK_INSET_PX[axis],
    });
    values = set.values;
    ctx = { decimals: set.decimals, step: set.step };
  }
  const format = settings.format ?? formatTick;
  return values.map((value) => ({ value, at: toPlot(value), label: format(value, ctx) }));
}

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
    grid,
    axes,
    xTicks,
    yTicks,
    tabIndex,
    role = 'img',
    className,
    style,
    onPointerDown,
    onKeyDown,
    children,
  } = props;

  const svgRef = useRef<SVGSVGElement | null>(null);

  const modelRange: ModelRange = useMemo(
    () => ({ xMin: xRange[0], xMax: xRange[1], yMin: yRange[0], yMax: yRange[1] }),
    [xRange, yRange],
  );

  const plotSize = useMemo(() => ({ width, height }), [width, height]);

  const clientToPlot = useCallback((e: { clientX: number; clientY: number }): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    return { x: e.clientX - left, y: e.clientY - top };
  }, []);

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

  const handlePointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (!onPointerDown) return;
    const plot = clientToPlot(e);
    const model = plotToModel(plot, modelRange, plotSize);
    onPointerDown(e, { plot, model });
  }, [onPointerDown, clientToPlot, modelRange, plotSize]);

  const xTickList = xTicks
    ? resolveTicks(xTicks, 'x', xRange, width, (v) => modelToPlot({ x: v, y: yRange[0] }, modelRange, plotSize).x)
    : [];
  const yTickList = yTicks
    ? resolveTicks(yTicks, 'y', yRange, height, (v) => modelToPlot({ x: xRange[0], y: v }, modelRange, plotSize).y)
    : [];

  // An inside y column is right-aligned against its widest label, which only
  // the rendered text can say.
  const yInside = !!yTicks && (yTicks.labels ?? 'inside') === 'inside';
  const yLabelsRef = useRef<SVGGElement | null>(null);
  const [yLabelWidth, setYLabelWidth] = useState(0);
  const yLabelKey = yInside ? yTickList.map((t) => t.label).join('\n') : '';
  useLayoutEffect(() => {
    if (!yInside) return;
    const measure = (): void => {
      let widest = 0;
      for (const el of yLabelsRef.current?.querySelectorAll('text') ?? []) {
        if (typeof el.getComputedTextLength === 'function') widest = Math.max(widest, el.getComputedTextLength());
      }
      setYLabelWidth((prev) => (prev === widest ? prev : widest));
    };
    measure();
    let live = true;
    // A web font landing after the first measure changes every width.
    document.fonts?.ready.then(() => { if (live) measure(); });
    return () => { live = false; };
  }, [yInside, yLabelKey]);

  const cls = [s.root, className].filter(Boolean).join(' ');

  const renderTickLines = (axis: Axis, list: ResolvedTick[], settings: TickSettings | false | null | undefined) => {
    if (!settings || settings.lines === false || list.length === 0) return null;
    return (
      <g>
        {list.map((t) => (
          <line
            key={`t${axis}-${t.value}`}
            data-plot-element="tick"
            data-axis={axis}
            className={s.tick}
            {...(axis === 'x'
              ? { x1: t.at, x2: t.at, y1: 0, y2: height }
              : { x1: 0, x2: width, y1: t.at, y2: t.at })}
          />
        ))}
      </g>
    );
  };

  const renderTickLabels = (axis: Axis, list: ResolvedTick[], settings: TickSettings | false | null | undefined) => {
    if (!settings || list.length === 0) return null;
    const placement = settings.labels ?? 'inside';
    if (placement === false) return null;
    const outside = placement === 'outside';
    const gap = settings.gap ?? LABEL_GAP_PX;
    let place: { x?: number; y?: number; textAnchor: 'start' | 'middle' | 'end'; dominantBaseline?: 'central' | 'hanging' };
    if (axis === 'y') {
      place = outside
        ? { x: -gap, textAnchor: 'end', dominantBaseline: 'central' }
        : yLabelWidth > 0
          ? { x: gap + yLabelWidth, textAnchor: 'end', dominantBaseline: 'central' }
          : { x: gap, textAnchor: 'start', dominantBaseline: 'central' };
    } else {
      place = outside
        ? { y: height + gap, textAnchor: 'middle', dominantBaseline: 'hanging' }
        : { y: height - gap, textAnchor: 'middle' };
    }
    return (
      <g ref={axis === 'y' ? yLabelsRef : undefined} className={s.tickLabels} aria-hidden="true">
        {list.map((t) => (
          <text
            key={`l${axis}-${t.value}`}
            data-plot-element="tick-label"
            data-axis={axis}
            data-placement={placement}
            className={s.tickLabel}
            x={axis === 'x' ? t.at : place.x}
            y={axis === 'y' ? t.at : place.y}
            textAnchor={place.textAnchor}
            dominantBaseline={place.dominantBaseline}
          >
            {t.label}
          </text>
        ))}
      </g>
    );
  };

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
      tabIndex={tabIndex}
      onPointerDown={onPointerDown ? handlePointerDown : undefined}
      onKeyDown={onKeyDown}
    >
      {grid && (() => {
        const divisions = grid.divisions ?? 3;
        const stroke = grid.color;
        // Evenly-spaced internal divisions, excluding the edges (which
        // belong to the axes). For divisions=3, fractions are 1/4, 2/4, 3/4.
        const fractions: number[] = [];
        for (let i = 1; i <= divisions; i++) fractions.push(i / (divisions + 1));
        return (
          <g>
            {fractions.map((f) => (
              <line
                key={`gx-${f}`}
                data-plot-element="grid"
                className={s.grid}
                stroke={stroke}
                x1={f * width} x2={f * width}
                y1={0} y2={height}
              />
            ))}
            {fractions.map((f) => (
              <line
                key={`gy-${f}`}
                data-plot-element="grid"
                className={s.grid}
                stroke={stroke}
                x1={0} x2={width}
                y1={f * height} y2={f * height}
              />
            ))}
          </g>
        );
      })()}
      {renderTickLines('x', xTickList, xTicks)}
      {renderTickLines('y', yTickList, yTicks)}
      {axes !== false && axes !== null && (() => {
        const stroke = axes?.color;
        return (
          <g>
            <line
              data-plot-element="axis"
              className={s.axis}
              stroke={stroke}
              x1={0} x2={width}
              y1={height} y2={height}
            />
            <line
              data-plot-element="axis"
              className={s.axis}
              stroke={stroke}
              x1={0} x2={0}
              y1={0} y2={height}
            />
          </g>
        );
      })()}
      {renderTickLabels('x', xTickList, xTicks)}
      {renderTickLabels('y', yTickList, yTicks)}
      {children}
    </svg>
  );
});
