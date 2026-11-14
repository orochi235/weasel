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
import { LayerHostContext, useLayerRegistry, type LayerEntry, type LayerHost } from './layerHost';
import { layerCtxOver, NO_MODIFIERS, readModifiers } from './layerCtx';
import type { HoldProps } from '../Disabled';
import { useControlHold } from '../Disabled/controlHold';
import { sameFields } from './sameFields';
import { useLayerHistory, type LayerSnapshot } from './useLayerHistory';
import type {
  LayerCtx, LayerGesture, LayerModifiers, ModelPoint, PlotPoint,
} from './layerTypes';

/** Props for {@link LayeredCurveEditor}. Disabled or read-only, no press, key, or context menu reaches a layer, and
 *  undo and redo do nothing; disabled with no reason, the plot and every mark in it leave the tab order. */
export interface LayeredCurveEditorProps extends HoldProps {
  /** The layers — `FunctionLayer`, `KeyframeLayer`, `CustomLayer` — and any plain SVG, drawn in order: a later
   *  child paints over an earlier one, and the topmost layer claiming a press takes it. */
  children?: ReactNode;

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
   *  the way a finished edit is reported: the layer's `onChange(restored)`,
   *  then its `onCommit(restored, current)`. Default `true`; turn it off
   *  when the consumer keeps its own undo or builds ops from `onCommit`,
   *  or each step is recorded twice. */
  history?: boolean;

  /** Accessible name for the plot, which is exposed as a group so the
   *  focusable marks layers render inside it stay reachable. */
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

interface ActiveGesture {
  entry: LayerEntry;
  gesture: LayerGesture<unknown>;
  startStates: LayerSnapshot;
  startSelfState: unknown;
}

/**
 * A `Plot2D` that hosts a stack of composable curve layers, given as its
 * children. It owns the pointer gestures and the coordinate mapping; each
 * layer supplies its own drawing, hit testing and gesture behavior.
 *
 * Layer state stays with the consumer: each layer reports changes through its
 * `onChange` during a gesture and its `onCommit` at the end, and the editor
 * reads the state back from the layer's props each frame. That is what lets
 * one layer's drag update another layer's state mid-gesture.
 */
export function LayeredCurveEditor(props: LayeredCurveEditorProps) {
  const {
    width, height,
    xRange = [0, 1], yRange = [0, 1],
    grid, axes, xTicks, yTicks,
    className, style, children,
  } = props;

  const historyEnabled = props.history !== false;
  const hold = useControlHold(props);

  const modelRange: ModelRange = useMemo(
    () => ({ xMin: xRange[0], xMax: xRange[1], yMin: yRange[0], yMax: yRange[1] }),
    [xRange, yRange],
  );
  const plotSize = useMemo(() => ({ width, height }), [width, height]);

  // Refs that always hold the latest props — gesture handlers and
  // window listeners close over these refs, never over render-time
  // values, so mid-drag re-renders (including cross-layer state
  // updates) are visible to the next pointermove tick.
  const { register, layers } = useLayerRegistry();
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
  const [activeEntry, setActiveEntry] = useState<LayerEntry | null>(null);

  // ── History (whole-state snapshots) ────────────────────────────────
  const { snapshot, record, undo, redo } = useLayerHistory(layers);

  // ── Pointer routing during an active gesture ───────────────────────
  // The session's callbacks are fixed at gesture start, so they delegate
  // through refs holding the latest committed impl — a mid-drag re-render
  // must reach the next pointermove tick.
  const sessionRef = useRef<PointerSession | null>(null);

  const cleanupGesture = useCallback(() => {
    sessionRef.current = null;
    activeRef.current = null;
    setActiveEntry(null);
  }, []);

  const findLayerState = useCallback((entry: LayerEntry) => (layers().includes(entry) ? entry.state : undefined), [layers]);

  const onGestureMoveRef = useLatest((e: PointerEvent) => {
    const a = activeRef.current;
    if (!a) return;
    const h = plotRef.current;
    if (!h) return;
    const model = h.clientToModel(e);
    const current = findLayerState(a.entry);
    if (current === undefined) return;
    const ctx = makeCtx(readModifiers(e));
    const next = a.gesture.onMove(current, model, e, ctx);
    if (next !== current) a.entry.onChange(next);
  });

  const onGestureEndRef = useLatest((e: PointerEvent) => {
    const a = activeRef.current;
    if (!a) return;
    const current = findLayerState(a.entry);
    if (current === undefined) { cleanupGesture(); return; }
    const ctx = makeCtx(readModifiers(e));
    const finalState = a.gesture.onCommit ? a.gesture.onCommit(current, ctx) : current;
    if (finalState !== current) a.entry.onChange(finalState);
    if (historyEnabled && !sameFields(finalState, a.startSelfState)) {
      record(a.startStates);
    }
    a.entry.onCommit?.(finalState, a.startSelfState);
    cleanupGesture();
  });

  const onGestureCancelRef = useLatest(() => {
    const a = activeRef.current;
    if (!a) return;
    const current = findLayerState(a.entry);
    if (current === undefined) { cleanupGesture(); return; }
    const ctx = makeCtx(NO_MODIFIERS);
    const restored = a.gesture.onCancel ? a.gesture.onCancel(current, ctx) : a.startSelfState;
    if (restored !== current) a.entry.onChange(restored);
    cleanupGesture();
  });

  // No pointer capture: consumers render their own SVG chrome into the plot
  // through `children`, and capture would retarget pointerup away from it.
  const installGesture = useCallback((
    entry: LayerEntry,
    down: ReactPointerEvent<SVGSVGElement>,
    gesture: LayerGesture<unknown>,
  ) => {
    const startStates = snapshot();
    const startSelfState = startStates.get(entry);
    activeRef.current = {
      entry, gesture,
      startStates,
      startSelfState,
    };
    setActiveEntry(entry);
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
    const ls = layers();
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
          commit(next) { committed = next; b.onChange(next); },
        },
      );
      e.stopPropagation();
      if (gesture) {
        installGesture(b, e, gesture);
        return;
      }
      if (committed !== undefined) {
        if (historyEnabled) record(preEventSnapshot);
        b.onCommit?.(committed, prevState);
      }
      return;
    }

    // No hit — empty space dispatch, top-to-bottom.
    let pendingCommit: { entry: LayerEntry; next: unknown; prev: unknown } | null = null;
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
            b.onChange(next);
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
        installGesture(b, e, gesture);
        if (committed !== undefined && activeRef.current !== null) {
          (activeRef.current as ActiveGesture).startStates = preEventSnapshot;
          (activeRef.current as ActiveGesture).startSelfState = preEventSnapshot.get(b);
        }
        return;
      }
      if (committed !== undefined) {
        pendingCommit = { entry: b, next: committed, prev: prevState };
        break;
      }
    }
    if (pendingCommit) {
      if (historyEnabled) record(preEventSnapshot);
      pendingCommit.entry.onCommit?.(pendingCommit.next, pendingCommit.prev);
    }
  }, [makeCtx, installGesture, historyEnabled, snapshot, record, layers]);

  // ── keyboard ───────────────────────────────────────────────────────
  const onSvgKeyDown = useCallback((e: ReactKeyboardEvent<SVGSVGElement>) => {
    const modifiers = readModifiers(e);
    const ctx = makeCtx(modifiers);
    const ls = layers();
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
      const prevState = b.state;
      b.layer.onKeyDown(prevState, e.nativeEvent, ctx, {
        commit(next) { committed = next; b.onChange(next); },
      });
      if (committed !== undefined) {
        if (historyEnabled) record(preEventSnapshot);
        b.onCommit?.(committed, prevState);
      }
      // The layer prevents default on the native event, which the synthetic
      // event's `isDefaultPrevented` does not observe.
      if (e.nativeEvent.defaultPrevented) return;
    }
  }, [historyEnabled, undo, redo, makeCtx, snapshot, record, layers]);

  const onSvgContextMenu = useCallback((
    e: ReactMouseEvent<SVGSVGElement>,
    coords: { plot: PlotPoint; model: ModelPoint },
  ) => {
    if (activeRef.current) return;
    const before = snapshot();
    const edit = dispatchContextMenu(layers(), coords, e.nativeEvent, makeCtx(readModifiers(e)));
    if (!edit) return;
    if (historyEnabled) record(before);
    edit.entry.onCommit?.(edit.next, edit.prev);
  }, [historyEnabled, makeCtx, snapshot, record, layers]);

  useEffect(() => () => { sessionRef.current?.cancel(); }, []);

  // ── render ─────────────────────────────────────────────────────────
  const renderCtxBase = useMemo(() => layerCtxOver(modelRange, plotSize, kitSettings), [modelRange, plotSize, kitSettings]);
  const host = useMemo<LayerHost>(() => ({ register, base: renderCtxBase, active: activeEntry }), [register, renderCtxBase, activeEntry]);

  const cls = [s.root, className].filter(Boolean).join(' ');

  return hold.wrap(
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
      tabIndex={historyEnabled ? hold.tabIndex(0) : undefined}
      role="group"
      aria-label={props['aria-label']}
      aria-disabled={hold.focus['aria-disabled']}
      aria-describedby={hold.focus['aria-describedby']}
      data-held={hold.held}
      inert={hold.unreachable || undefined}
      onPointerDown={hold.gate(onSvgPointerDown)}
      onContextMenu={hold.gate(onSvgContextMenu)}
      onKeyDown={hold.gate(onSvgKeyDown)}
    >
      <LayerHostContext.Provider value={host}>{children}</LayerHostContext.Provider>
    </Plot2D>
  );
}
