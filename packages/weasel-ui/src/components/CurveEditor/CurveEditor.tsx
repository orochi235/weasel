import { useCallback, useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
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
  /** Show a background grid. */
  showGrid?: boolean;
  /** Show axis lines + tick marks. */
  showAxes?: boolean;
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

  // Sample the curve in MODEL space, then project samples to plot space.
  const pathD = useMemo(() => {
    if (value.length < 2) return '';
    const modelSamples = sampleCurve(value, SAMPLES_PER_SEGMENT);
    const plotSamples = modelSamples.map((p) => modelToPlot(p, modelRange, plotSize));
    if (plotSamples.length === 0) return '';
    const parts: string[] = [`M${plotSamples[0].x.toFixed(2)},${plotSamples[0].y.toFixed(2)}`];
    for (let i = 1; i < plotSamples.length; i++) {
      parts.push(`L${plotSamples[i].x.toFixed(2)},${plotSamples[i].y.toFixed(2)}`);
    }
    return parts.join('');
  }, [value, modelRange, plotSize]);

  // ── Drag state ─────────────────────────────────────────────────────────
  interface DragState {
    index: number;
    pointerId: number;
    startValue: readonly ControlPoint[];
    lastNext: ControlPoint[];
  }
  const dragRef = useRef<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Refs to break the useCallback dependency cycle between the three
  // window-level handlers (each one needs to remove the others on cleanup).
  const onWindowMoveRef = useRef<(e: PointerEvent) => void>(() => {});
  const onWindowUpRef = useRef<(e: PointerEvent) => void>(() => {});
  const onWindowCancelRef = useRef<(e: PointerEvent) => void>(() => {});

  const pointerToModel = useCallback((clientX: number, clientY: number): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    const plot: Point = { x: clientX - left, y: clientY - top };
    return plotToModel(plot, modelRange, plotSize);
  }, [modelRange, plotSize]);

  const cleanupDrag = useCallback(() => {
    window.removeEventListener('pointermove', onWindowMoveRef.current);
    window.removeEventListener('pointerup', onWindowUpRef.current);
    window.removeEventListener('pointercancel', onWindowCancelRef.current);
    dragRef.current = null;
  }, []);

  onWindowMoveRef.current = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const m = pointerToModel(e.clientX, e.clientY);
    const next = d.startValue.map((p) => ({ ...p }));
    let nx = m.x;
    if (domain === '1d') {
      const left = d.index > 0 ? next[d.index - 1].x : -Infinity;
      const right = d.index < next.length - 1 ? next[d.index + 1].x : Infinity;
      nx = Math.max(left, Math.min(right, nx));
    }
    next[d.index] = { x: nx, y: m.y };
    d.lastNext = next;
    onChange(next);
  };

  onWindowUpRef.current = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (onChangeCommit) onChangeCommit(d.lastNext, d.startValue);
    cleanupDrag();
  };

  onWindowCancelRef.current = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    // Restore pre-drag value; no commit.
    onChange(d.startValue.map((p) => ({ ...p })));
    cleanupDrag();
  };

  const onPointerDownAnchor = useCallback((index: number, e: ReactPointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    // Shift+click → delete.
    if (e.shiftKey) {
      const next = value.filter((_, i) => i !== index);
      onChange(next);
      if (onChangeCommit) onChangeCommit(next, value);
      return;
    }
    dragRef.current = {
      index,
      pointerId: e.pointerId,
      startValue: value,
      lastNext: value.map((p) => ({ ...p })),
    };
    window.addEventListener('pointermove', onWindowMoveRef.current);
    window.addEventListener('pointerup', onWindowUpRef.current);
    window.addEventListener('pointercancel', onWindowCancelRef.current);
  }, [value, onChange, onChangeCommit]);

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
      if (onChangeCommit) onChangeCommit(next, value);
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
  }, [addPointMode, value, modelRange, plotSize, segmentSamples, domain, onChange, onChangeCommit]);

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
      {pathD && (
        <path
          className={s.curve}
          d={pathD}
          fill="none"
        />
      )}
      {plotAnchors.map((a, i) => (
        <circle
          key={i}
          className={s.anchor}
          cx={a.x}
          cy={a.y}
          r={4}
          data-anchor-index={i}
          onPointerDown={(e) => onPointerDownAnchor(i, e)}
        />
      ))}
    </svg>
  );
}
