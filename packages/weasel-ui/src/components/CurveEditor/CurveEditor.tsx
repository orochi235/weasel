import { useCallback, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { sampleCurve, type Point } from './catmullRom';
import { hitTestCurve, modelToPlot, plotToModel, type ModelRange } from './geometry';
import s from './CurveEditor.module.css';

export interface ControlPoint {
  x: number;
  y: number;
}

export type CurveDomain = '1d' | '2d';
export type EndpointMode = 'free' | 'pinned-x' | 'pinned-both';
export type AddPointMode = 'click-curve' | 'click-empty' | 'never';

export interface GridSettings {
  /** Number of evenly-spaced internal grid lines per axis (excluding the
   *  edges). Applied to both x and y. Default 3. */
  divisions?: number;
  /** Stroke color override. When omitted, uses `var(--curve-grid)`. */
  color?: string;
}

export interface AxesSettings {
  /** Stroke color override. When omitted, uses `var(--curve-axis)`. */
  color?: string;
}

export interface FillSettings {
  /** Which side of the curve gets filled — `'below'` shades the region
   *  between the curve and the bottom edge of the plot; `'above'` shades
   *  between the curve and the top edge. Required (no default — the
   *  whole point is to pick a side). */
  side: 'below' | 'above';
  /** Fill color override. When omitted, uses `var(--curve-fill)`
   *  (translucent accent). */
  color?: string;
}

export interface CurveEditorProps {
  /** Anchor points; caller-owned. */
  value: readonly ControlPoint[];
  /** Fires every frame during drag with the live in-flight value. */
  onChange: (next: ControlPoint[]) => void;
  /** Fires once per discrete user action (drag-end, add, delete) with
   *  the new value and the value at gesture start. Wire history here. */
  onChangeCommit?: (next: ControlPoint[], prev: readonly ControlPoint[]) => void;
  /** 1D function (monotonic in x) or 2D path. Default '2d'. */
  domain?: CurveDomain;
  /** Endpoint constraint mode. Default 'free'. */
  endpoints?: EndpointMode;
  /** Model-space x range. Default [0, 1]. */
  xRange?: readonly [number, number];
  /** Model-space y range. Default [0, 1]. */
  yRange?: readonly [number, number];
  /** Plot width in CSS pixels. */
  width: number;
  /** Plot height in CSS pixels. */
  height: number;
  /** Background grid configuration. `false` / `null` / omitted → no grid.
   *  Pass `{}` for default grid (3 divisions per axis) or a populated
   *  GridSettings to customize. */
  grid?: GridSettings | false | null;
  /** Axis line configuration. `false` / `null` → no axes. Omitted →
   *  default-styled axes (on). Pass an AxesSettings to customize. */
  axes?: AxesSettings | false | null;
  /** Shade the region under or over the curve. The algorithm closes the
   *  polyline back along the bottom (`below`) or top (`above`) edge of
   *  the plot — works cleanly for x-monotonic curves; produces visually
   *  reasonable but potentially overlapping fills for curves that loop
   *  back on themselves. Works in either domain. `false` / `null` /
   *  omitted = no fill. */
  fill?: FillSettings | false | null;
  /** How new anchors are added. Default 'click-curve'. */
  addPointMode?: AddPointMode;
  /** Extra class on the root SVG element. */
  className?: string;
  /** Inline style on the root SVG element. */
  style?: CSSProperties;
}

const SAMPLES_PER_SEGMENT = 16;

export function CurveEditor(props: CurveEditorProps) {
  const {
    value, width, height,
    onChange, onChangeCommit,
    domain = '2d',
    endpoints = 'free',
    addPointMode = 'click-curve',
    xRange = [0, 1],
    yRange = [0, 1],
    className,
    style,
  } = props;

  const modelRange: ModelRange = useMemo(
    () => ({ xMin: xRange[0], xMax: xRange[1], yMin: yRange[0], yMax: yRange[1] }),
    [xRange, yRange],
  );

  const plotSize = useMemo(() => ({ width, height }), [width, height]);

  // Project anchors to plot space for both rendering and (later) hit testing.
  const plotAnchors: Point[] = useMemo(
    () => value.map((a) => modelToPlot(a, modelRange, plotSize)),
    [value, modelRange, plotSize],
  );

  // Sample the curve once in MODEL space and project to plot space.
  // Shared by the curve `<path>` and (when fill is configured) the
  // fill region — avoids two passes through Catmull-Rom.
  const plotSamples = useMemo((): Point[] => {
    if (value.length < 2) return [];
    return sampleCurve(value, SAMPLES_PER_SEGMENT).map((p) => modelToPlot(p, modelRange, plotSize));
  }, [value, modelRange, plotSize]);

  const pathD = useMemo(() => {
    if (plotSamples.length === 0) return '';
    const parts: string[] = [`M${plotSamples[0].x.toFixed(2)},${plotSamples[0].y.toFixed(2)}`];
    for (let i = 1; i < plotSamples.length; i++) {
      parts.push(`L${plotSamples[i].x.toFixed(2)},${plotSamples[i].y.toFixed(2)}`);
    }
    return parts.join('');
  }, [plotSamples]);

  // Fill path: closed polygon between the curve and the chosen edge.
  // Only meaningful in 1D mode (the "below" / "above" question needs a
  // function). In 2D mode, returns null.
  const fillD = useMemo((): string | null => {
    if (!props.fill || plotSamples.length === 0) return null;
    const closingY = props.fill.side === 'below' ? height : 0;
    const first = plotSamples[0];
    const last = plotSamples[plotSamples.length - 1];
    const parts: string[] = [`M${first.x.toFixed(2)},${first.y.toFixed(2)}`];
    for (let i = 1; i < plotSamples.length; i++) {
      parts.push(`L${plotSamples[i].x.toFixed(2)},${plotSamples[i].y.toFixed(2)}`);
    }
    parts.push(`L${last.x.toFixed(2)},${closingY.toFixed(2)}`);
    parts.push(`L${first.x.toFixed(2)},${closingY.toFixed(2)}`);
    parts.push('Z');
    return parts.join('');
  }, [props.fill, plotSamples, height]);

  // ── Drag state ─────────────────────────────────────────────────────────
  interface DragState {
    index: number;
    pointerId: number;
    startValue: readonly ControlPoint[];
    lastNext: ControlPoint[];
  }
  const dragRef = useRef<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);

  // Refs to break the useCallback dependency cycle between the three
  // window-level handlers (each one needs to remove the others on cleanup).
  const onWindowMoveRef = useRef<(e: PointerEvent) => void>(() => {});
  const onWindowUpRef = useRef<(e: PointerEvent) => void>(() => {});
  const onWindowCancelRef = useRef<(e: PointerEvent) => void>(() => {});

  // Stable outer handlers — same function identity across renders.
  // They delegate to refs that point at the latest per-render handler.
  // Without this, `removeEventListener` would receive a different function
  // value than `addEventListener` did (because the per-render inner handlers
  // get reassigned every render), silently leaking listeners on each
  // controlled re-render during a drag.
  const stableMoveHandler = useRef((e: PointerEvent) => {
    onWindowMoveRef.current(e);
  }).current;
  const stableUpHandler = useRef((e: PointerEvent) => {
    onWindowUpRef.current(e);
  }).current;
  const stableCancelHandler = useRef((e: PointerEvent) => {
    onWindowCancelRef.current(e);
  }).current;

  const pointerToModel = useCallback((clientX: number, clientY: number): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    const plot: Point = { x: clientX - left, y: clientY - top };
    return plotToModel(plot, modelRange, plotSize);
  }, [modelRange, plotSize]);

  const cleanupDrag = useCallback(() => {
    window.removeEventListener('pointermove', stableMoveHandler);
    window.removeEventListener('pointerup', stableUpHandler);
    window.removeEventListener('pointercancel', stableCancelHandler);
    dragRef.current = null;
  }, [stableMoveHandler, stableUpHandler, stableCancelHandler]);

  onWindowMoveRef.current = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const m = pointerToModel(e.clientX, e.clientY);
    const next = d.startValue.map((p) => ({ ...p }));
    let nx = m.x;
    let ny = m.y;

    const isEndpoint = d.index === 0 || d.index === next.length - 1;

    if (endpoints === 'pinned-both' && isEndpoint) {
      nx = d.index === 0 ? modelRange.xMin : modelRange.xMax;
      ny = d.index === 0 ? modelRange.yMin : modelRange.yMax;
    } else if (endpoints === 'pinned-x' && isEndpoint) {
      nx = d.index === 0 ? modelRange.xMin : modelRange.xMax;
    } else if (domain === '1d') {
      const left = d.index > 0 ? next[d.index - 1].x : -Infinity;
      const right = d.index < next.length - 1 ? next[d.index + 1].x : Infinity;
      nx = Math.max(left, Math.min(right, nx));
    }

    next[d.index] = { x: nx, y: ny };
    d.lastNext = next;
    onChange(next);
  };

  onWindowUpRef.current = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (onChangeCommit) onChangeCommit(d.lastNext, d.startValue);
    setActiveDragIndex(null);
    cleanupDrag();
  };

  onWindowCancelRef.current = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    // Restore pre-drag value; no commit.
    onChange(d.startValue.map((p) => ({ ...p })));
    setActiveDragIndex(null);
    cleanupDrag();
  };

  const isPinnedEndpoint = useCallback((index: number): boolean => {
    if (endpoints === 'free') return false;
    return index === 0 || index === value.length - 1;
  }, [endpoints, value.length]);

  const onPointerDownAnchor = useCallback((index: number, e: ReactPointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    // Shift+click → delete.
    if (e.shiftKey) {
      if (isPinnedEndpoint(index)) return;
      const next = value.filter((_, i) => i !== index);
      onChange(next);
      if (onChangeCommit) onChangeCommit(next, value);
      return;
    }
    setActiveDragIndex(index);
    dragRef.current = {
      index,
      pointerId: e.pointerId,
      startValue: value,
      lastNext: value.map((p) => ({ ...p })),
    };
    window.addEventListener('pointermove', stableMoveHandler);
    window.addEventListener('pointerup', stableUpHandler);
    window.addEventListener('pointercancel', stableCancelHandler);
  }, [value, onChange, onChangeCommit, isPinnedEndpoint, stableMoveHandler, stableUpHandler, stableCancelHandler]);

  const segmentSamples = useMemo((): Point[][] => {
    if (value.length < 2) return [];
    const out: Point[][] = [];
    const all = sampleCurve(value, SAMPLES_PER_SEGMENT);
    for (let i = 0; i < value.length - 1; i++) {
      const start = i * SAMPLES_PER_SEGMENT;
      const end = start + SAMPLES_PER_SEGMENT;
      const slice = all.slice(start, end + 1);
      out.push(slice.map((p) => modelToPlot(p, modelRange, plotSize)));
    }
    return out;
  }, [value, modelRange, plotSize]);

  const onSvgPointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (addPointMode === 'never') return;
    const target = e.target as SVGElement;
    if (target.tagName === 'circle') return;

    const rect = svgRef.current?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    const plotPt: Point = { x: e.clientX - left, y: e.clientY - top };
    const modelPt = plotToModel(plotPt, modelRange, plotSize);

    if (addPointMode === 'click-curve') {
      const hit = hitTestCurve(segmentSamples, plotPt, 8);
      if (!hit) return;
      const insertIndex = hit.segIdx + 1;
      const next = [...value.slice(0, insertIndex), modelPt, ...value.slice(insertIndex)];
      onChange(next);
      // Begin a drag on the new anchor — commit fires on pointerup with the
      // final position so the user can slide the insertion precisely.
      setActiveDragIndex(insertIndex);
      dragRef.current = {
        index: insertIndex,
        pointerId: e.pointerId,
        startValue: value, // pre-insert value, so the commit's `prev` is correct
        lastNext: next,
      };
      window.addEventListener('pointermove', stableMoveHandler);
      window.addEventListener('pointerup', stableUpHandler);
      window.addEventListener('pointercancel', stableCancelHandler);
      return;
    }

    // 'click-empty'
    let insertIndex = value.length;
    if (domain === '1d') {
      for (let i = 0; i < value.length; i++) {
        if (value[i].x > modelPt.x) { insertIndex = i; break; }
      }
    }
    const next = [...value.slice(0, insertIndex), modelPt, ...value.slice(insertIndex)];
    onChange(next);
    if (onChangeCommit) onChangeCommit(next, value);
  }, [addPointMode, value, modelRange, plotSize, segmentSamples, domain, onChange, onChangeCommit, stableMoveHandler, stableUpHandler, stableCancelHandler]);

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
      onPointerDown={onSvgPointerDown}
    >
      {props.grid && (() => {
        const divisions = props.grid.divisions ?? 3;
        const stroke = props.grid.color;
        // Evenly-spaced internal divisions, excluding the edges (which
        // belong to the axes). For divisions=3, fractions are 1/4, 2/4, 3/4.
        const fractions: number[] = [];
        for (let i = 1; i <= divisions; i++) fractions.push(i / (divisions + 1));
        return (
          <g>
            {fractions.map((f) => (
              <line
                key={`gx-${f}`}
                data-curve-element="grid"
                className={s.grid}
                stroke={stroke}
                x1={f * width} x2={f * width}
                y1={0} y2={height}
              />
            ))}
            {fractions.map((f) => (
              <line
                key={`gy-${f}`}
                data-curve-element="grid"
                className={s.grid}
                stroke={stroke}
                x1={0} x2={width}
                y1={f * height} y2={f * height}
              />
            ))}
          </g>
        );
      })()}
      {props.axes !== false && props.axes !== null && (() => {
        const stroke = props.axes?.color;
        return (
          <g>
            <line
              data-curve-element="axis"
              className={s.axis}
              stroke={stroke}
              x1={0} x2={width}
              y1={height} y2={height}
            />
            <line
              data-curve-element="axis"
              className={s.axis}
              stroke={stroke}
              x1={0} x2={0}
              y1={0} y2={height}
            />
          </g>
        );
      })()}
      {fillD && (
        <path
          data-curve-element="fill"
          className={s.fill}
          d={fillD}
          fill={props.fill && props.fill !== null ? props.fill.color : undefined}
        />
      )}
      {pathD && (
        <path
          className={s.curve}
          d={pathD}
          fill="none"
        />
      )}
      {plotAnchors.map((a, i) => {
        const pinned = isPinnedEndpoint(i);
        const active = activeDragIndex === i;
        const anchorCls = [s.anchor, pinned && s.pinned, active && s.active].filter(Boolean).join(' ');
        return (
          <circle
            key={i}
            className={anchorCls}
            cx={a.x}
            cy={a.y}
            r={4}
            data-anchor-index={i}
            onPointerDown={(e) => onPointerDownAnchor(i, e)}
          />
        );
      })}
    </svg>
  );
}
