/**
 * The single-curve editor: a `LayeredCurveEditor` holding one function layer.
 * Several curves on one plot take `LayeredCurveEditor` and `FunctionLayer`.
 */
import {
  useCallback, useMemo, useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  type GridSettings,
  type AxesSettings,
  type TickSettings,
} from '../Plot2D';
import type { InterpolationMode } from '@weasel-js/geom';
import {
  type ControlPoint,
  type CurveDomain,
  type EndpointMode,
  type AddPointMode,
  type CurveSettings,
  type FillSettings,
  type AnchorRenderProps,
  type FunctionLayerState,
} from './createFunctionLayer';
import { LayeredCurveEditor } from './LayeredCurveEditor';
import { FunctionLayer } from './FunctionLayer';
import { useLatest } from '@weasel-js/core';
import type { HoldProps } from '../Disabled';
import { ownHold } from '../Disabled/controlHold';

export type { GridSettings, AxesSettings, TickSettings };
export type {
  ControlPoint, CurveDomain, EndpointMode, AddPointMode,
  CurveSettings, FillSettings, AnchorRenderProps,
};

/**
 * Props for {@link CurveEditor}. `onInput` fires throughout a gesture and
 * `onChange` once at its end, with the pre-gesture points as `prev`. An undo
 * or redo of the built-in `history` is reported through both, like any other
 * finished change; a consumer that keeps its own undo turns `history` off.
 * Disabled or read-only, it is held as a {@link LayeredCurveEditor} is.
 */
export interface CurveEditorProps extends HoldProps {
  value: readonly ControlPoint[];
  onInput: (next: ControlPoint[]) => void;
  onChange?: (next: ControlPoint[], prev: readonly ControlPoint[]) => void;
  domain?: CurveDomain;
  interpolation?: InterpolationMode;
  endpoints?: EndpointMode;
  xRange?: readonly [number, number];
  yRange?: readonly [number, number];
  width: number;
  height: number;
  grid?: GridSettings | false | null;
  axes?: AxesSettings | false | null;
  xTicks?: TickSettings | false | null;
  yTicks?: TickSettings | false | null;
  curve?: CurveSettings | false | null;
  fill?: FillSettings | false | null;
  hideNonInteractive?: boolean;
  constrain?: 'none' | 'function';
  history?: boolean;
  minPoints?: number;
  maxPoints?: number;
  addPointMode?: AddPointMode;
  renderAnchor?: (info: AnchorRenderProps) => ReactNode;
  /** Drawn under the curve, in order: plain SVG, or more layers, which a press reaches after the curve. */
  children?: ReactNode;
  /** Accessible name for the plot. */
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Editable curve through a list of control points: drag anchors, click to
 * insert, right-click to delete, with optional built-in undo.
 *
 * This is the single-curve API, implemented as one `FunctionLayer` on top of
 * a `LayeredCurveEditor`. Reach for those directly to stack several curves
 * on one plot.
 */
export function CurveEditor(props: CurveEditorProps) {
  const {
    value, onInput, onChange,
    domain, endpoints, interpolation, constrain, addPointMode,
    minPoints, maxPoints, curve, fill, hideNonInteractive, renderAnchor,
    width, height, xRange, yRange, grid, axes, xTicks, yTicks, history,
    className, style, children,
  } = props;

  // The points are local only while an anchor is held, so a drag advances
  // without the consumer writing `value` back on every move. Outside one,
  // `value` is what is drawn, including when the consumer declined or
  // normalized what `onInput` offered.
  const [held, setHeld] = useState<FunctionLayerState | null>(null);
  const idle = useMemo<FunctionLayerState>(() => ({ points: value, activeIndex: null }), [value]);
  const layerState = held ?? idle;
  const layerStateRef = useLatest(layerState);

  const handleLayerChange = useCallback((next: FunctionLayerState) => {
    const prevPoints = layerStateRef.current.points;
    setHeld(next.activeIndex === null ? null : next);
    if (next.points !== prevPoints) {
      onInput(next.points as ControlPoint[]);
    }
  }, [onInput, layerStateRef]);

  const handleLayerCommit = useCallback((next: FunctionLayerState, prev: FunctionLayerState) => {
    if (!onChange) return;
    if (next.points !== prev.points) {
      onChange?.(next.points as ControlPoint[], prev.points);
    }
  }, [onChange]);

  return (
    <LayeredCurveEditor
      {...ownHold(props)}
      width={width}
      height={height}
      xRange={xRange}
      yRange={yRange}
      grid={grid}
      axes={axes}
      xTicks={xTicks}
      yTicks={yTicks}
      history={history}
      aria-label={props['aria-label']}
      className={className}
      style={style}
    >
      {children}
      <FunctionLayer
        id="function"
        state={layerState}
        onChange={handleLayerChange}
        onCommit={handleLayerCommit}
        domain={domain} endpoints={endpoints} interpolation={interpolation} constrain={constrain}
        addPointMode={addPointMode} minPoints={minPoints} maxPoints={maxPoints} curve={curve} fill={fill}
        hideNonInteractive={hideNonInteractive} renderAnchor={renderAnchor}
      />
    </LayeredCurveEditor>
  );
}
