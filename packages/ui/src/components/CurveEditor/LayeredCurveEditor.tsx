import {
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { historyKey, openPointerSession, useLatest, type PointerSession } from '@weasel-js/core';
import { useKitSettings } from '@weasel-js/react';
import {
  Plot2D,
  type Plot2DHandle,
  type GridSettings,
  type AxesSettings,
  type TickSettings,
} from '../Plot2D';
import type { ModelRange } from '../Plot2D/geometry';
import { dlog } from '../../dlog';
import s from './CurveEditor.module.css';
import { dispatchContextMenu } from './contextMenuDispatch';
import { CurveLayers } from './CurveLayers';
import { layerCtxOver } from './layerCtx';
import { sameFields } from './sameFields';
import { useLayerHistory, type LayerSnapshot } from './useLayerHistory';
import type {
  CurveLayer, LayerCtx, LayerGesture, LayerModifiers, ModelPoint, PlotPoint,
} from './layerTypes';

/**
 * A layer paired with the state the consumer holds for it. The editor never
 * stores layer state itself.
 */
export interface LayerBinding<S = unknown> {
  layer: CurveLayer<S>;
  state: S;
}

/** Props for {@link LayeredCurveEditor}. */
export interface LayeredCurveEditorProps {
  /** Bottom-to-top render order: `layers[0]` paints first, `layers[N-1]`
   *  paints on top. Hit-testing runs in reverse (topmost claim wins). */
  layers: ReadonlyArray<LayerBinding<unknown>>;

  /** Fires every frame during a gesture with the live in-flight state
   *  for the layer that owns the gesture. */
  onLayerChange(id: string, next: unknown): void;

  /** Fires once per discrete user action (drag-end, one-shot insert,
   *  delete, undo, redo) for the layer that produced the change. `prev` is
   *  the layer's state before the action. */
  onLayerCommit?(id: string, next: unknown, prev: unknown): void;

  width: number;
  height: number;
  /** Model-space x range. Default [0, 1]. */
  xRange?: readonly [number, number];
  /** Model-space y range. Default [0, 1]. */
  yRange?: readonly [number, number];
  grid?: GridSettings | false | null;
  axes?: AxesSettings | false | null;
  /** Ticks at x values. See `Plot2D.xTicks`. */
  xTicks?: TickSettings | false | null;
  /** Ticks at y values. See `Plot2D.yTicks`. */
  yTicks?: TickSettings | false | null;

  /** Built-in undo/redo via Cmd/Ctrl+Z (Shift+Z or Y for redo) on the
   *  focused SVG. Snapshots every layer's state on each commit, keeping
   *  the last 100. An undo or redo reports each layer whose state changed
   *  the way a finished edit is reported: `onLayerChange(id, restored)`,
   *  then `onLayerCommit(id, restored, current)`. Default `true`; turn it
   *  off when the consumer keeps its own undo or builds ops from
   *  `onLayerCommit`, or each step is recorded twice. */
  history?: boolean;

  /** Accessible name for the plot, which is exposed as a group so the
   *  focusable marks layers render inside it stay reachable. */
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;

  /** Extra SVG content rendered behind all layers (under the lowest
   *  layer but above grid/axes). Use this for static chrome that isn't
   *  worth modeling as a layer. */
  children?: ReactNode;
}

interface ActiveGesture {
  layerId: string;
  gesture: LayerGesture<unknown>;
  startStates: LayerSnapshot;
  startSelfState: unknown;
}

/** A cancel carries no event, so a layer's `onCancel` sees no modifiers held. */
const NO_MODIFIERS: LayerModifiers = { shift: false, alt: false, meta: false, ctrl: false };

function readModifiers(e: PointerEvent | ReactPointerEvent | ReactMouseEvent | KeyboardEvent | ReactKeyboardEvent): LayerModifiers {
  return {
    shift: e.shiftKey,
    alt: e.altKey,
    meta: e.metaKey,
    ctrl: e.ctrlKey,
  };
}

/**
 * A `Plot2D` that hosts a stack of composable curve layers. It owns the
 * pointer gestures and the coordinate mapping; each layer supplies its own
 * drawing, hit testing and gesture behavior.
 *
 * Layer state stays with the consumer: the editor reports changes through
 * `onLayerChange` during a gesture and `onLayerCommit` at its end, and reads
 * the state back from props each frame. That is what lets one layer's drag
 * update another layer's state mid-gesture.
 */
export function LayeredCurveEditor(props: LayeredCurveEditorProps) {
  const {
    layers, onLayerChange, onLayerCommit,
    width, height,
    xRange = [0, 1], yRange = [0, 1],
    grid, axes, xTicks, yTicks,
    className, style, children,
  } = props;

  const historyEnabled = props.history !== false;

  const modelRange: ModelRange = useMemo(
    () => ({ xMin: xRange[0], xMax: xRange[1], yMin: yRange[0], yMax: yRange[1] }),
    [xRange, yRange],
  );
  const plotSize = useMemo(() => ({ width, height }), [width, height]);

  // Refs that always hold the latest props — gesture handlers and
  // window listeners close over these refs, never over render-time
  // values, so mid-drag re-renders (including cross-layer state
  // updates) are visible to the next pointermove tick.
  const layersRef = useLatest(layers);
  const modelRangeRef = useLatest(modelRange);
  const plotSizeRef = useLatest(plotSize);
  const kitSettings = useKitSettings();

  const plotRef = useRef<Plot2DHandle | null>(null);

  // ── Coord helpers ──────────────────────────────────────────────────
  const makeCtx = useCallback(
    (modifiers: LayerModifiers): LayerCtx => ({ ...layerCtxOver(modelRangeRef.current, plotSizeRef.current, kitSettings), modifiers }),
    [modelRangeRef, plotSizeRef, kitSettings],
  );

  // ── Gesture routing ────────────────────────────────────────────────
  const activeRef = useRef(null as ActiveGesture | null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  // ── History (whole-state snapshots) ────────────────────────────────
  const { snapshot, record, undo, redo } = useLayerHistory(layersRef, onLayerChange, onLayerCommit);

  // ── Pointer routing during an active gesture ───────────────────────
  // The session's callbacks are fixed at gesture start, so they delegate
  // through refs holding the latest committed impl — a mid-drag re-render
  // must reach the next pointermove tick.
  const sessionRef = useRef<PointerSession | null>(null);

  const cleanupGesture = useCallback(() => {
    sessionRef.current = null;
    activeRef.current = null;
    setActiveLayerId(null);
  }, []);

  const findLayerState = useCallback((id: string): unknown | undefined => {
    for (const b of layersRef.current) if (b.layer.id === id) return b.state;
    return undefined;
  }, [layersRef]);

  const onGestureMoveRef = useLatest((e: PointerEvent) => {
    const a = activeRef.current;
    if (!a) return;
    const h = plotRef.current;
    if (!h) return;
    const model = h.clientToModel(e);
    const current = findLayerState(a.layerId);
    if (current === undefined) return;
    const ctx = makeCtx(readModifiers(e));
    const next = a.gesture.onMove(current, model, e, ctx);
    if (next !== current) onLayerChange(a.layerId, next);
  });

  const onGestureEndRef = useLatest((e: PointerEvent) => {
    const a = activeRef.current;
    if (!a) return;
    const current = findLayerState(a.layerId);
    if (current === undefined) { cleanupGesture(); return; }
    const ctx = makeCtx(readModifiers(e));
    const finalState = a.gesture.onCommit ? a.gesture.onCommit(current, ctx) : current;
    if (finalState !== current) onLayerChange(a.layerId, finalState);
    if (historyEnabled && !sameFields(finalState, a.startSelfState)) {
      record(a.startStates);
    }
    if (onLayerCommit) onLayerCommit(a.layerId, finalState, a.startSelfState);
    cleanupGesture();
  });

  const onGestureCancelRef = useLatest(() => {
    const a = activeRef.current;
    if (!a) return;
    const current = findLayerState(a.layerId);
    if (current === undefined) { cleanupGesture(); return; }
    const ctx = makeCtx(NO_MODIFIERS);
    const restored = a.gesture.onCancel ? a.gesture.onCancel(current, ctx) : a.startSelfState;
    if (restored !== current) onLayerChange(a.layerId, restored);
    cleanupGesture();
  });

  // No pointer capture: consumers render their own SVG chrome into the plot
  // through `children`, and capture would retarget pointerup away from it.
  const installGesture = useCallback((
    layerId: string,
    down: ReactPointerEvent<SVGSVGElement>,
    gesture: LayerGesture<unknown>,
  ) => {
    const startStates = snapshot();
    const startSelfState = startStates.get(layerId);
    activeRef.current = {
      layerId, gesture,
      startStates,
      startSelfState,
    };
    setActiveLayerId(layerId);
    sessionRef.current = openPointerSession(down.currentTarget, down, {
      onMove: (e) => onGestureMoveRef.current(e),
      onEnd: (e) => onGestureEndRef.current(e),
      onCancel: () => onGestureCancelRef.current(),
    }, { capture: false });
  }, [snapshot, onGestureCancelRef, onGestureEndRef, onGestureMoveRef]);

  // ── pointerdown dispatch ───────────────────────────────────────────
  const onSvgPointerDown = useCallback((
    e: ReactPointerEvent<SVGSVGElement>,
    coords: { plot: PlotPoint; model: ModelPoint },
  ) => {
    if (activeRef.current) return; // ignore secondary touches mid-gesture
    const modifiers = readModifiers(e);
    const ctx = makeCtx(modifiers);
    const ls = layersRef.current;
    const nativeEvent = e.nativeEvent;

    dlog('layered-curve-editor', 'pointerdown', { plot: coords.plot, model: coords.model, layers: ls.length });

    // Capture the pre-event snapshot once; reuse for history if any
    // path produces a commit (gesture-start commit or one-shot).
    const preEventSnapshot = snapshot();

    // Top-to-bottom hit test.
    for (let i = ls.length - 1; i >= 0; i--) {
      const b = ls[i];
      const hit = b.layer.hitTest?.(b.state, coords.plot, ctx);
      if (!hit) continue;
      // Found a claim. onPointerDown may start a gesture, absorb the
      // click, or commit a one-shot edit via extra.commit.
      const prevState = b.state;
      let committed: unknown = undefined;
      const gesture = b.layer.onPointerDown?.(
        prevState, hit, nativeEvent, ctx,
        {
          plot: coords.plot,
          model: coords.model,
          commit(next) { committed = next; onLayerChange(b.layer.id, next); },
        },
      );
      e.stopPropagation();
      if (gesture) {
        installGesture(b.layer.id, e, gesture);
        return;
      }
      if (committed !== undefined) {
        if (historyEnabled) {
          record(preEventSnapshot);
        }
        onLayerCommit?.(b.layer.id, committed, prevState);
      }
      return;
    }

    // No hit — empty space dispatch, top-to-bottom.
    let pendingCommit: { id: string; next: unknown; prev: unknown } | null = null;
    for (let i = ls.length - 1; i >= 0; i--) {
      const b = ls[i];
      if (!b.layer.onEmptyPointerDown) continue;
      const prevState = b.state;
      let committed: unknown = undefined;
      const gesture = b.layer.onEmptyPointerDown(
        prevState, coords.model, nativeEvent, ctx,
        {
          plot: coords.plot,
          model: coords.model,
          commit(next) {
            committed = next;
            onLayerChange(b.layer.id, next);
          },
        },
      );
      if (gesture) {
        // If onEmptyPointerDown also published a commit (e.g. click-curve
        // insert publishes the new point then drags it), the gesture's
        // startStates already capture the post-insert state; the commit
        // for history is the *pre*-event snapshot, written when the
        // gesture eventually finishes via the gesture-commit path. We
        // override the gesture's startStates so undo restores correctly.
        installGesture(b.layer.id, e, gesture);
        if (committed !== undefined && activeRef.current !== null) {
          (activeRef.current as ActiveGesture).startStates = preEventSnapshot;
          (activeRef.current as ActiveGesture).startSelfState = preEventSnapshot.get(b.layer.id);
        }
        return;
      }
      if (committed !== undefined) {
        pendingCommit = { id: b.layer.id, next: committed, prev: prevState };
        break;
      }
    }
    if (pendingCommit) {
      if (historyEnabled) {
        record(preEventSnapshot);
      }
      onLayerCommit?.(pendingCommit.id, pendingCommit.next, pendingCommit.prev);
    }
  }, [makeCtx, installGesture, onLayerChange, onLayerCommit, historyEnabled, snapshot, record, layersRef]);

  // ── keyboard ───────────────────────────────────────────────────────
  const onSvgKeyDown = useCallback((e: ReactKeyboardEvent<SVGSVGElement>) => {
    const modifiers = readModifiers(e);
    const ctx = makeCtx(modifiers);
    const ls = layersRef.current;
    // History first.
    const step = historyEnabled ? historyKey(e) : null;
    if (step) {
      if (step === 'redo') redo();
      else undo();
      e.preventDefault();
      return;
    }
    // Then layers (top-to-bottom).
    for (let i = ls.length - 1; i >= 0; i--) {
      const b = ls[i];
      if (!b.layer.onKeyDown) continue;
      const preEventSnapshot = snapshot();
      let committed: unknown = undefined;
      b.layer.onKeyDown(b.state, e.nativeEvent, ctx, {
        commit(next) { committed = next; onLayerChange(b.layer.id, next); },
      });
      if (committed !== undefined) {
        if (historyEnabled) {
          record(preEventSnapshot);
        }
        onLayerCommit?.(b.layer.id, committed, b.state);
      }
      // The layer prevents default on the native event, which the synthetic
      // event's `isDefaultPrevented` does not observe.
      if (e.nativeEvent.defaultPrevented) return;
    }
  }, [historyEnabled, undo, redo, makeCtx, snapshot, record, onLayerChange, onLayerCommit, layersRef]);

  const onSvgContextMenu = useCallback((
    e: ReactMouseEvent<SVGSVGElement>,
    coords: { plot: PlotPoint; model: ModelPoint },
  ) => {
    if (activeRef.current) return;
    const before = snapshot();
    const edit = dispatchContextMenu(layersRef.current, coords, e.nativeEvent, makeCtx(readModifiers(e)), onLayerChange);
    if (!edit) return;
    if (historyEnabled) record(before);
    onLayerCommit?.(edit.id, edit.next, edit.prev);
  }, [historyEnabled, makeCtx, snapshot, record, onLayerChange, onLayerCommit, layersRef]);

  useEffect(() => () => { sessionRef.current?.cancel(); }, []);

  // ── render ─────────────────────────────────────────────────────────
  const renderCtxBase = useMemo(() => layerCtxOver(modelRange, plotSize, kitSettings), [modelRange, plotSize, kitSettings]);

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
      grid={grid}
      axes={axes}
      xTicks={xTicks}
      yTicks={yTicks}
      tabIndex={historyEnabled ? 0 : undefined}
      role="group"
      aria-label={props['aria-label']}
      onPointerDown={onSvgPointerDown}
      onContextMenu={onSvgContextMenu}
      onKeyDown={onSvgKeyDown}
    >
      {children}
      <CurveLayers layers={layers} base={renderCtxBase} activeLayerId={activeLayerId} />
    </Plot2D>
  );
}
