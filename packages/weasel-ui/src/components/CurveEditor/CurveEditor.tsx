import { useMemo, type CSSProperties } from 'react';
import { sampleCurve, type Point } from './catmullRom';
import { modelToPlot, type ModelRange } from './geometry';
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

  const cls = [s.root, className].filter(Boolean).join(' ');

  return (
    <svg
      className={cls}
      style={style}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
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
        />
      ))}
    </svg>
  );
}
