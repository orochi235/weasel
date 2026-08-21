/**
 * Back-compat wrapper around `LayeredCurveEditor` that preserves the
 * original single-curve API. New consumers wanting multi-layer
 * composition should reach for `LayeredCurveEditor` + `createFunctionLayer`
 * directly.
 */
import {
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import {
  type GridSettings,
  type AxesSettings,
} from '../Plot2D';
import type { InterpolationMode } from './interpolation';
import {
  createFunctionLayer,
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

export type { GridSettings, AxesSettings };
export type {
  ControlPoint, CurveDomain, EndpointMode, AddPointMode,
  CurveSettings, FillSettings, AnchorRenderProps,
};

/**
 * Props for {@link CurveEditor}. `onChange` fires throughout a gesture and
 * `onChangeCommit` once at its end, with the pre-gesture points as `prev`.
 */
export interface CurveEditorProps {
  value: readonly ControlPoint[];
  onChange: (next: ControlPoint[]) => void;
  onChangeCommit?: (next: ControlPoint[], prev: readonly ControlPoint[]) => void;
  domain?: CurveDomain;
  interpolation?: InterpolationMode;
  endpoints?: EndpointMode;
  xRange?: readonly [number, number];
  yRange?: readonly [number, number];
  width: number;
  height: number;
  grid?: GridSettings | false | null;
  axes?: AxesSettings | false | null;
  curve?: CurveSettings | false | null;
  fill?: FillSettings | false | null;
  hideNonInteractive?: boolean;
  constrain?: 'none' | 'function';
  history?: boolean;
  minPoints?: number;
  maxPoints?: number;
  addPointMode?: AddPointMode;
  renderAnchor?: (info: AnchorRenderProps) => ReactNode;
  /** Extra SVG content rendered behind the curve and anchors. */
  decorations?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Editable curve through a list of control points: drag anchors, click to
 * insert, right-click to delete, with optional built-in undo.
 *
 * This is the single-curve API, implemented as one `createFunctionLayer` on
 * a `LayeredCurveEditor`. Reach for those directly to stack several curves
 * on one plot.
 */
export function CurveEditor(props: CurveEditorProps) {
  const {
    value, onChange, onChangeCommit,
    domain, endpoints, interpolation, constrain, addPointMode,
    minPoints, maxPoints, curve, fill, hideNonInteractive, renderAnchor,
    width, height, xRange, yRange, grid, axes, history,
    className, style, decorations,
  } = props;

  // Layer is config-only; rebuild only when *config* changes.
  const layer = useMemo(() => createFunctionLayer({
    id: 'function',
    domain, endpoints, interpolation, constrain, addPointMode,
    minPoints, maxPoints, curve, fill, hideNonInteractive, renderAnchor,
  }), [
    domain, endpoints, interpolation, constrain, addPointMode,
    minPoints, maxPoints, curve, fill, hideNonInteractive, renderAnchor,
  ]);

  // Hybrid controlled-state: the wrapper holds the full FunctionLayerState
  // locally so that consumers using the original CurveEditor API don't
  // have to wire their `value` prop back through on every drag tick to
  // keep the in-flight gesture advancing. We adopt the consumer's
  // `value` prop when it changes externally (and no gesture is active).
  const [layerState, setLayerState] = useState<FunctionLayerState>(
    () => ({ points: value, activeIndex: null }),
  );
  // Ref mirror so the layerChange callback can compare against the
  // freshest state without re-binding on every render.
  const layerStateRef = useRef(layerState);
  layerStateRef.current = layerState;

  // Sync from controlled `value` when the consumer updates it externally
  // and we're idle. Skip the update during a gesture so drag-in-flight
  // points aren't clobbered by a stale `value`.
  useEffect(() => {
    if (layerStateRef.current.activeIndex !== null) return;
    if (layerStateRef.current.points === value) return;
    setLayerState({ points: value, activeIndex: null });
  }, [value]);

  const handleLayerChange = useCallback((_id: string, nextUnknown: unknown) => {
    const next = nextUnknown as FunctionLayerState;
    const prevPoints = layerStateRef.current.points;
    setLayerState(next);
    if (next.points !== prevPoints) {
      onChange(next.points as ControlPoint[]);
    }
  }, [onChange]);

  const handleLayerCommit = useCallback((_id: string, nextUnknown: unknown, prevUnknown: unknown) => {
    if (!onChangeCommit) return;
    const next = nextUnknown as FunctionLayerState;
    const prev = prevUnknown as FunctionLayerState;
    if (next.points !== prev.points) {
      onChangeCommit(next.points as ControlPoint[], prev.points);
    }
  }, [onChangeCommit]);

  // Right-click on an anchor → delete (preserves original CurveEditor
  // behavior). LayeredCurveEditor doesn't model contextmenu as a
  // gesture; we intercept at the wrapper level by walking the DOM
  // target for `data-anchor-index`.
  const onContextMenu = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as Element | null;
    const node = target?.closest?.('[data-anchor-index]') as Element | null;
    if (!node) return;
    e.preventDefault();
    e.stopPropagation();
    const idxAttr = node.getAttribute('data-anchor-index');
    if (idxAttr === null) return;
    const idx = Number(idxAttr);
    const points = layerStateRef.current.points;
    if (!Number.isInteger(idx) || idx < 0 || idx >= points.length) return;
    if (points[idx]?.locked) return;
    if (endpoints !== undefined && endpoints !== 'free' && (idx === 0 || idx === points.length - 1)) return;
    if (minPoints !== undefined && points.length <= minPoints) return;
    const next = points.filter((_, i) => i !== idx);
    setLayerState({ points: next, activeIndex: null });
    onChange(next as ControlPoint[]);
    onChangeCommit?.(next as ControlPoint[], points);
  }, [endpoints, minPoints, onChange, onChangeCommit]);

  const layers = useMemo(() => [{ layer, state: layerState }], [layer, layerState]);

  return (
    <div
      onContextMenu={onContextMenu}
      style={{ display: 'contents' }}
    >
      <LayeredCurveEditor
        layers={layers}
        onLayerChange={handleLayerChange}
        onLayerCommit={handleLayerCommit}
        width={width}
        height={height}
        xRange={xRange}
        yRange={yRange}
        grid={grid}
        axes={axes}
        history={history}
        className={className}
        style={style}
      >
        {decorations}
      </LayeredCurveEditor>
    </div>
  );
}
