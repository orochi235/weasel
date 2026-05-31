import {
  useCallback, useMemo, useRef, useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { type Point } from './catmullRom';
import { sampleByInterpolation, type InterpolationMode } from './interpolation';
import {
  Plot2D,
  type Plot2DHandle,
  type GridSettings,
  type AxesSettings,
} from '../Plot2D';
import { modelToPlot, type ModelRange } from '../Plot2D/geometry';
import { hitTestCurve } from './hitTest';
import s from './CurveEditor.module.css';

// Re-export so existing CurveEditor consumers keep working.
export type { GridSettings, AxesSettings };

export interface ControlPoint {
  x: number;
  y: number;
  /** When true, this control point can't be moved or deleted by the
   *  user. Render as a smaller diamond with locked styling.
   *  Independent of `endpoints` — a locked anchor can be at any
   *  position, not just at the canvas edges. */
  locked?: boolean;
}

export type CurveDomain = '1d' | '2d';
export type EndpointMode = 'free' | 'pinned-x' | 'pinned-both';
export type AddPointMode = 'click-curve' | 'click-empty' | 'never';

/** Per-anchor render context passed to `renderAnchor`. Coordinates are in
 *  plot (SVG) space, ready to drop into `cx/cy` or `transform`. */
export interface AnchorRenderProps {
  point: ControlPoint;
  index: number;
  cx: number;
  cy: number;
  isActive: boolean;
  isLocked: boolean;
  isPinnedEndpoint: boolean;
  isEndpoint: boolean;
}

/** Curve-render configuration. Empty today — color/width are still
 *  driven by the `--curve-*` CSS vars on the component root. Reserved
 *  for future per-instance overrides. */
export interface CurveSettings {
  // Intentionally empty for now.
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
  /** Interpolation algorithm. All options are interpolating (the curve
   *  passes through every anchor); they differ in tangent computation
   *  and parameterization. Default `'catmull-rom'` (centripetal). */
  interpolation?: InterpolationMode;
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
  /** Whether to draw the curve `<path>` between anchors. `false` / `null`
   *  hide the curve while keeping anchors, drag, add, and delete
   *  behavior intact — used by `PointPlotter` to present the same
   *  gesture surface without connecting the points. Omitted → curve is
   *  drawn (default). */
  curve?: CurveSettings | false | null;
  /** Shade the region under or over the curve. The algorithm closes the
   *  polyline back along the bottom (`below`) or top (`above`) edge of
   *  the plot — works cleanly for x-monotonic curves; produces visually
   *  reasonable but potentially overlapping fills for curves that loop
   *  back on themselves. Works in either domain. `false` / `null` /
   *  omitted = no fill. */
  fill?: FillSettings | false | null;
  /** When true, vertex handles that aren't interactive (currently:
   *  pinned endpoints) are hidden entirely. Useful when an endpoint is
   *  fixed by design and shouldn't draw user attention. Interactive
   *  handles always render. Default false. */
  hideNonInteractive?: boolean;
  /** Constrain the curve to a class of shapes regardless of the
   *  caller's `interpolation` / `domain` settings.
   *
   *  - `'none'` (default): no enforcement. Interpolation can overshoot,
   *    fold back, exceed bounds — whatever the chosen algorithm does.
   *  - `'function'`: the result is guaranteed to be a function
   *    y = f(x) within the visible plot bounds. Enforced by (a)
   *    clamping each anchor's x to be strictly between its neighbors'
   *    x values during drag, (b) overriding `interpolation` with
   *    `'monotone'` regardless of caller (the only algo guaranteed
   *    not to overshoot y or fold x), and (c) the existing
   *    canvas-bounds clamp on y.
   *
   *  In `'function'` mode the `domain` and `interpolation` props are
   *  effectively shadowed — caller's choices for those still flow
   *  through but the constraint logic supersedes them where they
   *  conflict. */
  constrain?: 'none' | 'function';
  /** Built-in undo/redo via keyboard when the component has focus.
   *  Default `true`.
   *
   *  When on, the component listens for Cmd/Ctrl+Z (undo) and
   *  Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y (redo) on the focused SVG. Each
   *  `onChangeCommit` event pushes the previous value onto an internal
   *  past stack; undo pops it, fires `onChange(previousValue)` (NOT
   *  `onChangeCommit` — undo isn't a fresh commit). Consumers using
   *  an external history layer (weasel-history etc.) should set
   *  `history={false}` so the two systems don't fight.
   *
   *  Overriding: capture-phase keydown on any ancestor runs before
   *  the component's bubble-phase handler — call `stopPropagation()`
   *  there to consume the keystroke yourself. */
  history?: boolean;
  /** Minimum allowed control-point count. When `value.length <=
   *  minPoints`, user-initiated deletion (shift-click on an interior
   *  anchor) is refused. Doesn't mutate `value` if the caller starts
   *  outside the range — that's the caller's responsibility. */
  minPoints?: number;
  /** Maximum allowed control-point count. When `value.length >=
   *  maxPoints`, user-initiated insertion (click-curve or click-empty)
   *  is refused. */
  maxPoints?: number;
  /** How new anchors are added. Default 'click-curve'. */
  addPointMode?: AddPointMode;
  /** Custom anchor renderer. When provided and returns a non-null node, it
   *  replaces the default circle/diamond visuals for that anchor. The
   *  returned content is wrapped in a `<g data-anchor-index>` that owns the
   *  pointerdown/contextmenu handlers, so callers don't need to wire
   *  gestures themselves — they just draw. Returning `null` falls back to
   *  the default visual for that anchor. */
  renderAnchor?: (info: AnchorRenderProps) => ReactNode;
  /** Extra SVG content rendered inside the plot's SVG between the grid
   *  and the anchors. Useful for connecting lines, region shading, or
   *  any decoration that should sit beneath the anchor handles. */
  decorations?: ReactNode;
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

  // Project anchors to plot space for rendering. Uses the same
  // transform Plot2D exposes via its handle; we call the pure function
  // directly here because the ref isn't populated on the first render
  // pass and the math is identical.
  const plotAnchors: Point[] = useMemo(
    () => value.map((a) => modelToPlot(a, modelRange, plotSize)),
    [value, modelRange, plotSize],
  );

  // Sample the curve once in MODEL space and project to plot space.
  // Shared by the curve `<path>` and (when fill is configured) the
  // fill region — avoids two sampling passes.
  // When `constrain='function'`, the only safe interpolation is
  // 'monotone' (Fritsch-Carlson) — it's the only algo guaranteed not
  // to overshoot y or backtrack in x within a segment. Override the
  // caller's preference.
  const constrain = props.constrain ?? 'none';
  const interpolation = constrain === 'function'
    ? 'monotone'
    : (props.interpolation ?? 'catmull-rom');
  const plotSamples = useMemo((): Point[] => {
    if (value.length < 2) return [];
    return sampleByInterpolation(value, SAMPLES_PER_SEGMENT, interpolation)
      .map((p) => modelToPlot(p, modelRange, plotSize));
  }, [value, modelRange, plotSize, interpolation]);

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
  // `startValue` is the array shape the drag handler indexes into —
  // for an in-progress click-curve insert, this is the POST-insertion
  // shape so `next[index]` writes to the newly-inserted anchor, not a
  // stale slot. `commitPrev` is what onChangeCommit's `prev` callback
  // arg should receive — for click-curve insert, that's the PRE-insert
  // value so consumers see a clean "added one point" diff. For plain
  // anchor drags they're equal (and commitPrev is omitted).
  interface DragState {
    index: number;
    pointerId: number;
    startValue: readonly ControlPoint[];
    /** Optional override for the `prev` arg passed to onChangeCommit
     *  on release. When undefined, the commit uses startValue. Set
     *  during click-curve insertion so the commit reports the
     *  pre-insertion array as prev. */
    commitPrev?: readonly ControlPoint[];
    lastNext: ControlPoint[];
  }
  const dragRef = useRef<DragState | null>(null);
  const plotRef = useRef<Plot2DHandle | null>(null);
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);

  // ── Internal undo/redo stacks ───────────────────────────────────────
  // Refs (not state) — they don't drive rendering. The actual value
  // change goes through onChange, which the consumer is responsible for
  // reflecting in `value`. We just track the snapshot history so undo
  // can hand the consumer the right past value.
  const historyEnabled = props.history !== false;
  const pastRef = useRef<ControlPoint[][]>([]);
  const futureRef = useRef<ControlPoint[][]>([]);
  // Live `value` for the key handlers — useState closures would capture
  // stale values mid-keypress.
  const valueRef = useRef(value);
  valueRef.current = value;

  /** Internal: record a commit into the past stack. Called from the
   *  drag/insert/delete paths after each onChange settles. Clears the
   *  redo stack — any new edit invalidates the redo path. */
  const recordCommit = useCallback((prev: readonly ControlPoint[]) => {
    if (!historyEnabled) return;
    pastRef.current.push(prev.map((p) => ({ ...p })));
    futureRef.current = [];
  }, [historyEnabled]);

  const undo = useCallback(() => {
    if (!historyEnabled) return;
    const past = pastRef.current;
    if (past.length === 0) return;
    const prev = past.pop()!;
    futureRef.current.push(valueRef.current.map((p) => ({ ...p })));
    onChange(prev);
  }, [historyEnabled, onChange]);

  const redo = useCallback(() => {
    if (!historyEnabled) return;
    const future = futureRef.current;
    if (future.length === 0) return;
    const next = future.pop()!;
    pastRef.current.push(valueRef.current.map((p) => ({ ...p })));
    onChange(next);
  }, [historyEnabled, onChange]);

  const onSvgKeyDown = useCallback((e: ReactKeyboardEvent<SVGSVGElement>) => {
    if (!historyEnabled) return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'z') {
      if (e.shiftKey) redo();
      else undo();
      e.preventDefault();
    } else if (k === 'y') {
      redo();
      e.preventDefault();
    }
  }, [historyEnabled, undo, redo]);

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
    const h = plotRef.current;
    if (!h) return { x: 0, y: 0 };
    return h.clientToModel({ clientX, clientY });
  }, []);

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
    } else if (constrain === 'function' || domain === '1d') {
      // Both modes constrain x to between neighbors. `function` mode
      // requires STRICT monotonicity (an epsilon gap so two anchors
      // never share an x); plain 1D allows equal x.
      const epsilon = constrain === 'function'
        ? (modelRange.xMax - modelRange.xMin) / 1000
        : 0;
      const left = d.index > 0 ? next[d.index - 1].x + epsilon : -Infinity;
      const right = d.index < next.length - 1 ? next[d.index + 1].x - epsilon : Infinity;
      nx = Math.max(left, Math.min(right, nx));
    }

    // Clamp to model range so vertices never leave the visible plot.
    // Handle inverted ranges (e.g. yRange=[height,0]) by normalising bounds.
    {
      const xLo = Math.min(modelRange.xMin, modelRange.xMax);
      const xHi = Math.max(modelRange.xMin, modelRange.xMax);
      const yLo = Math.min(modelRange.yMin, modelRange.yMax);
      const yHi = Math.max(modelRange.yMin, modelRange.yMax);
      nx = Math.max(xLo, Math.min(xHi, nx));
      ny = Math.max(yLo, Math.min(yHi, ny));
    }

    next[d.index] = { x: nx, y: ny };
    d.lastNext = next;
    onChange(next);
  };

  onWindowUpRef.current = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const prev = d.commitPrev ?? d.startValue;
    recordCommit(prev);
    if (onChangeCommit) onChangeCommit(d.lastNext, prev);
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

  // "Fully locked" — caller marked the anchor `locked: true`. These
  // anchors swallow pointer gestures entirely. Pinned-both endpoints
  // are NOT locked: they accept drag input (so onChange/onChangeCommit
  // still fire with the clamped-to-corner value), but the move handler
  // pins both axes so the visual position doesn't change. Delete
  // protection for pinned endpoints lives in `isPinnedEndpoint`.
  const isLocked = useCallback((index: number): boolean => {
    return value[index]?.locked === true;
  }, [value]);

  const deleteAnchor = useCallback((index: number): void => {
    if (isLocked(index)) return;
    if (isPinnedEndpoint(index)) return;
    if (props.minPoints !== undefined && value.length <= props.minPoints) return;
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    recordCommit(value);
    if (onChangeCommit) onChangeCommit(next, value);
  }, [isLocked, isPinnedEndpoint, props.minPoints, value, onChange, onChangeCommit, recordCommit]);

  const onContextMenuAnchor = useCallback((index: number, e: ReactMouseEvent<SVGElement>) => {
    // Right-click → delete. Always suppress the browser menu over an
    // anchor, even if the delete is refused (locked / pinned / minPoints).
    e.preventDefault();
    e.stopPropagation();
    deleteAnchor(index);
  }, [deleteAnchor]);

  const onPointerDownAnchor = useCallback((index: number, e: ReactPointerEvent<SVGElement>) => {
    e.stopPropagation();
    // Locked anchors swallow the gesture entirely — no drag, no delete.
    if (isLocked(index)) return;
    // Shift+click → delete.
    if (e.shiftKey) {
      deleteAnchor(index);
      return;
    }
    // Right-click is handled by onContextMenu; don't start a drag.
    if (e.button === 2) return;
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
  }, [value, isLocked, deleteAnchor, stableMoveHandler, stableUpHandler, stableCancelHandler]);

  const segmentSamples = useMemo((): Point[][] => {
    if (value.length < 2) return [];
    const out: Point[][] = [];
    const all = sampleByInterpolation(value, SAMPLES_PER_SEGMENT, interpolation);
    for (let i = 0; i < value.length - 1; i++) {
      const start = i * SAMPLES_PER_SEGMENT;
      const end = start + SAMPLES_PER_SEGMENT;
      const slice = all.slice(start, end + 1);
      out.push(slice.map((p) => modelToPlot(p, modelRange, plotSize)));
    }
    return out;
  }, [value, modelRange, plotSize, interpolation]);

  const onSvgPointerDown = useCallback((
    e: ReactPointerEvent<SVGSVGElement>,
    coords: { plot: Point; model: Point },
  ) => {
    if (addPointMode === 'never') return;
    // Refuse if we'd exceed the configured maximum.
    if (props.maxPoints !== undefined && value.length >= props.maxPoints) return;
    const target = e.target as SVGElement;
    if (target.tagName === 'circle') return;

    const plotPt = coords.plot;
    const modelPt = coords.model;

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
        startValue: next,        // post-insertion shape so move-handler index aligns
        commitPrev: value,       // pre-insertion is what `prev` in onChangeCommit should be
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
    recordCommit(value);
    if (onChangeCommit) onChangeCommit(next, value);
  }, [addPointMode, value, segmentSamples, domain, props.maxPoints, onChange, onChangeCommit, recordCommit, stableMoveHandler, stableUpHandler, stableCancelHandler]);

  const cls = [s.root, className].filter(Boolean).join(' ');

  return (
    <Plot2D
      ref={plotRef}
      className={cls}
      style={style}
      width={width}
      height={height}
      xRange={xRange}
      yRange={yRange}
      grid={props.grid}
      axes={props.axes}
      tabIndex={historyEnabled ? 0 : undefined}
      onPointerDown={onSvgPointerDown}
      onKeyDown={historyEnabled ? onSvgKeyDown : undefined}
    >
      {fillD && (
        <path
          data-curve-element="fill"
          className={s.fill}
          d={fillD}
          fill={props.fill && props.fill !== null ? props.fill.color : undefined}
        />
      )}
      {pathD && props.curve !== false && props.curve !== null && (
        <path
          className={s.curve}
          d={pathD}
          fill="none"
        />
      )}
      {props.decorations}
      {plotAnchors.map((a, i) => {
        const pinned = isPinnedEndpoint(i);
        const locked = isLocked(i);
        // Hide non-interactive handles when requested. Locked anchors
        // and pinned endpoints both qualify (caller can't move them).
        if ((locked || pinned) && props.hideNonInteractive) return null;
        const active = activeDragIndex === i;
        // "Endpoint" semantics only apply when the curve is drawn — the
        // first/last anchors of an undrawn polyline aren't meaningfully
        // endpoints. PointPlotter relies on this to render all its
        // points as plain circles.
        const curveDrawn = props.curve !== false && props.curve !== null;
        const isEndpoint = curveDrawn && (i === 0 || i === value.length - 1);
        // Custom anchor renderer (opt-in). Wrap in a <g> that owns the
        // gesture handlers so callers don't have to re-implement drag/
        // delete; they just draw the visual.
        if (props.renderAnchor) {
          const node = props.renderAnchor({
            point: value[i],
            index: i,
            cx: a.x,
            cy: a.y,
            isActive: active,
            isLocked: locked,
            isPinnedEndpoint: pinned,
            isEndpoint,
          });
          if (node !== null && node !== undefined) {
            return (
              <g
                key={i}
                data-anchor-index={i}
                onPointerDown={(e) => onPointerDownAnchor(i, e)}
                onContextMenu={(e) => onContextMenuAnchor(i, e)}
              >
                {node}
              </g>
            );
          }
        }
        const anchorCls = [
          s.anchor,
          isEndpoint && s.endpoint,
          (pinned || locked) && s.pinned,
          locked && s.locked,
          active && s.active,
        ].filter(Boolean).join(' ');
        // Shape rule:
        // - Locked anchor: small diamond (area ≈ interior circle area)
        // - Endpoint (not locked): larger diamond (current size)
        // - Interior anchor: circle
        const renderAsDiamond = isEndpoint || locked;
        if (renderAsDiamond) {
          // Locked diamond half = 3.55 → underlying square side 7.1 →
          // area ≈ 50, matching interior circle (r=4, area π·16 ≈ 50.3).
          // Unlocked endpoint stays slightly larger so the draggable
          // affordance still reads at high visual weight.
          const half = locked ? 3.55 : 5;
          return (
            <rect
              key={i}
              className={anchorCls}
              x={a.x - half}
              y={a.y - half}
              width={half * 2}
              height={half * 2}
              transform={`rotate(45 ${a.x} ${a.y})`}
              data-anchor-index={i}
              onPointerDown={(e) => onPointerDownAnchor(i, e)}
              onContextMenu={(e) => onContextMenuAnchor(i, e)}
            />
          );
        }
        return (
          <circle
            key={i}
            className={anchorCls}
            cx={a.x}
            cy={a.y}
            r={4}
            data-anchor-index={i}
            onPointerDown={(e) => onPointerDownAnchor(i, e)}
            onContextMenu={(e) => onContextMenuAnchor(i, e)}
          />
        );
      })}
    </Plot2D>
  );
}
