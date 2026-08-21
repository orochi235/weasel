import type { CSSProperties, ReactNode } from 'react';
import {
  CurveEditor,
  type AnchorRenderProps,
  type ControlPoint,
  type CurveEditorProps,
} from '../CurveEditor';
import type { GridSettings, AxesSettings } from '../Plot2D';

/** Props for {@link PointPlotter}. */
export interface PointPlotterProps {
  /** Plotted points; caller-owned. */
  value: readonly ControlPoint[];
  /** Fires every frame during drag with the live in-flight value. */
  onChange: (next: ControlPoint[]) => void;
  /** Fires once per discrete user action (drag-end, add, delete) with
   *  the new value and the value at gesture start. Wire history here. */
  onChangeCommit?: (next: ControlPoint[], prev: readonly ControlPoint[]) => void;
  /** Model-space x range. Default [0, 1]. */
  xRange?: readonly [number, number];
  /** Model-space y range. Default [0, 1]. */
  yRange?: readonly [number, number];
  width: number;
  height: number;
  grid?: GridSettings | false | null;
  axes?: AxesSettings | false | null;
  /** Minimum allowed point count. User-initiated deletion is refused
   *  while `value.length <= minPoints`. */
  minPoints?: number;
  /** Maximum allowed point count. User-initiated insertion is refused
   *  while `value.length >= maxPoints`. */
  maxPoints?: number;
  /** How new points are added. Default `'click-empty'`. Set to `'never'`
   *  to disable insertion entirely. */
  addPointMode?: 'click-empty' | 'never';
  /** Built-in undo/redo via keyboard when the component has focus.
   *  Default `true`. See `CurveEditor.history` for details. */
  history?: boolean;
  /** Custom per-anchor renderer. See `CurveEditor.renderAnchor`. */
  renderAnchor?: (info: AnchorRenderProps) => ReactNode;
  /** Extra SVG content beneath the anchors. See `CurveEditor.decorations`. */
  decorations?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * 2D point plotter — a CurveEditor with the curve hidden. Anchors,
 * drag, shift+click delete, right-click delete, and click-empty insert
 * are inherited from CurveEditor verbatim, so the two components share
 * gesture semantics and stay in sync as CurveEditor evolves.
 *
 * Differences from CurveEditor: no curve `<path>` drawn, no fill, no
 * endpoint pinning, no interpolation, default `addPointMode` is
 * `'click-empty'` (CurveEditor defaults to `'click-curve'`, which
 * doesn't make sense without a curve to hit-test against).
 */
export function PointPlotter(props: PointPlotterProps) {
  const curveProps: CurveEditorProps = {
    ...props,
    addPointMode: props.addPointMode ?? 'click-empty',
    curve: false,
    fill: false,
    endpoints: 'free',
  };
  return <CurveEditor {...curveProps} />;
}
