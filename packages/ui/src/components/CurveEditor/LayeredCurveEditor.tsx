import {
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  Plot2D,
  type Plot2DHandle,
  type GridSettings,
  type AxesSettings,
} from '../Plot2D';
import {
  modelToPlot, plotToModel,
  type ModelRange,
} from '../Plot2D/geometry';
import { dlog } from '../../dlog';
import s from './CurveEditor.module.css';
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
  layers: ReadonlyArray<LayerBinding<any>>;

  /** Fires every frame during a gesture with the live in-flight state
   *  for the layer that owns the gesture. */
  onLayerChange(id: string, next: unknown): void;

  /** Fires once per discrete user action (drag-end, one-shot insert,
   *  delete) for the layer that produced the change. `prev` is the
   *  layer's state at gesture start. */
  onLayerCommit?(id: string, next: unknown, prev: unknown): void;

  width: number;
  height: number;
  /** Model-space x range. Default [0, 1]. */
  xRange?: readonly [number, number];
  /** Model-space y range. Default [0, 1]. */
  yRange?: readonly [number, number];
  grid?: GridSettings | false | null;
  axes?: AxesSettings | false | null;

  /** Built-in undo/redo via Cmd/Ctrl+Z (Shift+Z or Y for redo) on the
   *  focused SVG. Snapshots every layer's state on each commit; undo
   *  fires `onLayerChange(id, prevState)` for each layer whose state
   *  changed. Default `true`. */
  history?: boolean;

  className?: string;
  style?: CSSProperties;

  /** Extra SVG content rendered behind all layers (under the lowest
   *  layer but above grid/axes). Use this for static chrome that isn't
   *  worth modeling as a layer. */
  children?: ReactNode;
}

interface ActiveGesture {
  layerId: string;
  pointerId: number;
  gesture: LayerGesture<any>;
  startStates: Map<string, unknown>;
  startSelfState: unknown;
}

function readModifiers(e: PointerEvent | ReactPointerEvent<any> | KeyboardEvent | ReactKeyboardEvent<any>): LayerModifiers {
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
    grid, axes,
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
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const modelRangeRef = useRef(modelRange);
  modelRangeRef.current = modelRange;
  const plotSizeRef = useRef(plotSize);
  plotSizeRef.current = plotSize;

  const plotRef = useRef<Plot2DHandle | null>(null);

  // ── Coord helpers ──────────────────────────────────────────────────
  const makeCtx = useCallback((modifiers: LayerModifiers): LayerCtx => {
    const mr = modelRangeRef.current;
    const ps = plotSizeRef.current;
    return {
      modelRange: mr,
      plotSize: ps,
      toPlot: (p) => modelToPlot(p, mr, ps),
      toModel: (p) => plotToModel(p, mr, ps),
      modifiers,
    };
  }, []);

  // ── Gesture routing ────────────────────────────────────────────────
  const activeRef = useRef(null as ActiveGesture | null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  // ── History (whole-state snapshots) ────────────────────────────────
  const pastRef = useRef<Map<string, unknown>[]>([]);
  const futureRef = useRef<Map<string, unknown>[]>([]);

  const snapshot = useCallback((): Map<string, unknown> => {
    const m = new Map<string, unknown>();
    for (const b of layersRef.current) m.set(b.layer.id, b.state);
    return m;
  }, []);

  const restore = useCallback((snap: Map<string, unknown>) => {
    const current = layersRef.current;
    for (const b of current) {
      const prev = snap.get(b.layer.id);
      if (prev !== undefined && prev !== b.state) {
        onLayerChange(b.layer.id, prev);
      }
    }
  }, [onLayerChange]);

  const undo = useCallback(() => {
    if (!historyEnabled) return;
    const past = pastRef.current;
    if (past.length === 0) return;
    const prev = past.pop()!;
    futureRef.current.push(snapshot());
    restore(prev);
  }, [historyEnabled, snapshot, restore]);

  const redo = useCallback(() => {
    if (!historyEnabled) return;
    const future = futureRef.current;
    if (future.length === 0) return;
    const next = future.pop()!;
    pastRef.current.push(snapshot());
    restore(next);
  }, [historyEnabled, snapshot, restore]);

  // ── Window-level pointer routing during an active gesture ──────────
  // Stable identity across renders so addEventListener / removeEventListener
  // see the same function. Delegate to refs that point at the latest
  // per-render impl.
  const onWindowMoveRef = useRef<(e: PointerEvent) => void>(() => {});
  const onWindowUpRef = useRef<(e: PointerEvent) => void>(() => {});
  const onWindowCancelRef = useRef<(e: PointerEvent) => void>(() => {});

  const stableMove = useRef((e: PointerEvent) => onWindowMoveRef.current(e)).current;
  const stableUp = useRef((e: PointerEvent) => onWindowUpRef.current(e)).current;
  const stableCancel = useRef((e: PointerEvent) => onWindowCancelRef.current(e)).current;

  const cleanupGesture = useCallback(() => {
    window.removeEventListener('pointermove', stableMove);
    window.removeEventListener('pointerup', stableUp);
    window.removeEventListener('pointercancel', stableCancel);
    activeRef.current = null;
    setActiveLayerId(null);
  }, [stableMove, stableUp, stableCancel]);

  const findLayerState = useCallback((id: string): unknown | undefined => {
    for (const b of layersRef.current) if (b.layer.id === id) return b.state;
    return undefined;
  }, []);

  onWindowMoveRef.current = (e: PointerEvent) => {
    const a = activeRef.current;
    if (!a || a.pointerId !== e.pointerId) return;
    const h = plotRef.current;
    if (!h) return;
    const model = h.clientToModel(e);
    const current = findLayerState(a.layerId);
    if (current === undefined) return;
    const ctx = makeCtx(readModifiers(e));
    const next = a.gesture.onMove(current, model, e, ctx);
    if (next !== current) onLayerChange(a.layerId, next);
  };

  onWindowUpRef.current = (e: PointerEvent) => {
    const a = activeRef.current;
    if (!a || a.pointerId !== e.pointerId) return;
    const current = findLayerState(a.layerId);
    if (current === undefined) { cleanupGesture(); return; }
    const ctx = makeCtx(readModifiers(e));
    const finalState = a.gesture.onCommit ? a.gesture.onCommit(current, ctx) : current;
    if (finalState !== current) onLayerChange(a.layerId, finalState);
    if (historyEnabled) {
      pastRef.current.push(a.startStates);
      futureRef.current = [];
    }
    if (onLayerCommit) onLayerCommit(a.layerId, finalState, a.startSelfState);
    cleanupGesture();
  };

  onWindowCancelRef.current = (e: PointerEvent) => {
    const a = activeRef.current;
    if (!a || a.pointerId !== e.pointerId) return;
    const current = findLayerState(a.layerId);
    if (current === undefined) { cleanupGesture(); return; }
    const ctx = makeCtx(readModifiers(e));
    const restored = a.gesture.onCancel ? a.gesture.onCancel(current, ctx) : a.startSelfState;
    if (restored !== current) onLayerChange(a.layerId, restored);
    cleanupGesture();
  };

  const installGesture = useCallback((layerId: string, pointerId: number, gesture: LayerGesture<any>) => {
    const startStates = snapshot();
    const startSelfState = startStates.get(layerId);
    activeRef.current = {
      layerId, pointerId, gesture,
      startStates,
      startSelfState,
    };
    setActiveLayerId(layerId);
    window.addEventListener('pointermove', stableMove);
    window.addEventListener('pointerup', stableUp);
    window.addEventListener('pointercancel', stableCancel);
  }, [snapshot, stableMove, stableUp, stableCancel]);

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
        installGesture(b.layer.id, e.pointerId, gesture);
        return;
      }
      if (committed !== undefined) {
        if (historyEnabled) {
          pastRef.current.push(preEventSnapshot);
          futureRef.current = [];
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
        installGesture(b.layer.id, e.pointerId, gesture);
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
        pastRef.current.push(preEventSnapshot);
        futureRef.current = [];
      }
      onLayerCommit?.(pendingCommit.id, pendingCommit.next, pendingCommit.prev);
    }
  }, [makeCtx, installGesture, onLayerChange, onLayerCommit, historyEnabled, snapshot]);

  // ── keyboard ───────────────────────────────────────────────────────
  const onSvgKeyDown = useCallback((e: ReactKeyboardEvent<SVGSVGElement>) => {
    const modifiers = readModifiers(e);
    const ctx = makeCtx(modifiers);
    const ls = layersRef.current;
    // History first.
    if (historyEnabled && (e.metaKey || e.ctrlKey)) {
      const k = e.key.toLowerCase();
      if (k === 'z') {
        if (e.shiftKey) redo();
        else undo();
        e.preventDefault();
        return;
      }
      if (k === 'y') { redo(); e.preventDefault(); return; }
    }
    // Then layers (top-to-bottom).
    for (let i = ls.length - 1; i >= 0; i--) {
      const b = ls[i];
      b.layer.onKeyDown?.(b.state, e.nativeEvent, ctx);
      if (e.isDefaultPrevented()) return;
    }
  }, [historyEnabled, undo, redo, makeCtx]);

  // Clean up listeners on unmount.
  useEffect(() => () => {
    window.removeEventListener('pointermove', stableMove);
    window.removeEventListener('pointerup', stableUp);
    window.removeEventListener('pointercancel', stableCancel);
  }, [stableMove, stableUp, stableCancel]);

  // ── render ─────────────────────────────────────────────────────────
  const renderCtxBase: Omit<LayerCtx, 'modifiers'> = useMemo(() => ({
    modelRange,
    plotSize,
    toPlot: (p) => modelToPlot(p, modelRange, plotSize),
    toModel: (p) => plotToModel(p, modelRange, plotSize),
  }), [modelRange, plotSize]);

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
      tabIndex={historyEnabled ? 0 : undefined}
      onPointerDown={onSvgPointerDown}
      onKeyDown={onSvgKeyDown}
    >
      {children}
      {layers.map((b) => {
        const ctx = {
          ...renderCtxBase,
          modifiers: { shift: false, alt: false, meta: false, ctrl: false },
          isActive: activeLayerId === b.layer.id,
        };
        return (
          <g key={b.layer.id} data-layer-id={b.layer.id}>
            {b.layer.render(b.state, ctx)}
          </g>
        );
      })}
    </Plot2D>
  );
}
