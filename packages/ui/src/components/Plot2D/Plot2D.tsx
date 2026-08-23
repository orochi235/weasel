import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  modelToPlot, plotToModel,
  type ModelRange, type Point,
} from './geometry';
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
  /** Forwarded to the underlying svg. Consumer opts into focus this way. */
  tabIndex?: number;
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

/**
 * An SVG plotting surface with an optional grid and axes. It draws the frame
 * and owns the model-space to plot-space mapping; the plotted content is
 * whatever children are passed, positioned in plot space.
 */
export const Plot2D = forwardRef<Plot2DHandle, Plot2DProps>(function Plot2D(props, ref) {
  const {
    width, height,
    xRange = [0, 1],
    yRange = [0, 1],
    grid,
    axes,
    tabIndex,
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

  const cls = [s.root, className].filter(Boolean).join(' ');

  return (
    <svg
      ref={svgRef}
      className={cls}
      style={style}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
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
      {children}
    </svg>
  );
});
