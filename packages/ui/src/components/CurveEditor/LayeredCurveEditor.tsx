import {
  useCallback, useMemo, useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { historyKey } from '@weasel-js/gestures';
import type { ModifierState } from '@weasel-js/routing';
import { useKitSettings, useLatest } from '@weasel-js/react';
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
import { dispatchContextMenu, dispatchPress, offerKey, type LayerEdit, type LayerPoint } from './layerDispatch';
import { LayerHostContext, settleLayer, useLayerRegistry, type LayerHost } from './layerHost';
import { layerCtxOver, readModifiers } from './layerCtx';
import type { HoldProps } from '../Disabled';
import { useControlHold } from '../Disabled/controlHold';
import { useLayerHistory, type LayerSnapshot } from './useLayerHistory';
import { useLayerGesture } from './useLayerGesture';
import type { LayerCtx } from './layerTypes';

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
   *  the last 100. An undo or redo is an edit to each layer whose state it
   *  changes, reported as one. Default `true`; turn it off when the consumer
   *  keeps its own undo or builds ops from `onChange`, or each step is
   *  recorded twice. */
  history?: boolean;

  /** Accessible name for the plot, which is exposed as a group so the
   *  focusable marks layers render inside it stay reachable. */
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * A `Plot2D` that hosts a stack of composable curve layers, given as its
 * children. It owns the pointer gestures and the coordinate mapping; each
 * layer supplies its own drawing, hit testing and gesture behavior.
 *
 * Layer state stays with the consumer: each layer reports an edit through its
 * `onInput` while it runs and its `onChange` at the end, and the editor reads
 * the state back from the layer's props each frame. That is what lets one
 * layer's drag update another layer's state mid-gesture. Escape cancels a drag.
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

  const { register, layers } = useLayerRegistry();
  const modelRangeRef = useLatest(modelRange);
  const plotSizeRef = useLatest(plotSize);
  const kitSettings = useKitSettings();
  const plotRef = useRef<Plot2DHandle | null>(null);

  // Handlers read the plot through refs, never render-time values, so a
  // mid-drag re-render (another layer's state included) reaches the next move.
  const makeCtx = useCallback(
    (modifiers: ModifierState): LayerCtx => ({ ...layerCtxOver(modelRangeRef.current, plotSizeRef.current, kitSettings), modifiers }),
    [modelRangeRef, plotSizeRef, kitSettings],
  );

  const { snapshot, record, undo, redo } = useLayerHistory(layers);

  /** Report a finished one-shot edit, as one undo step back to `before`. */
  const settleEdit = useCallback((before: LayerSnapshot, edit: LayerEdit) => {
    if (historyEnabled) record(before);
    settleLayer(edit.entry, { commit: edit.next, prev: edit.prev });
  }, [historyEnabled, record]);

  const { start, busy, activeEntry } = useLayerGesture({
    toModel: (e) => plotRef.current?.clientToModel(e) ?? null,
    ctxFor: makeCtx,
    layers,
    onEdit: (before) => { if (historyEnabled) record(before); },
  });

  const onSvgPointerDown = useCallback((
    e: ReactPointerEvent<SVGSVGElement>,
    coords: LayerPoint,
  ) => {
    if (busy()) return; // ignore secondary touches mid-gesture
    const ls = layers();
    dlog('layered-curve-editor', 'pointerdown', { plot: coords.plot, model: coords.model, layers: ls.length });
    const before = snapshot();
    const press = dispatchPress(ls, coords, e.nativeEvent, makeCtx(readModifiers(e)));
    if (!press) return;
    if (press.claimed) e.stopPropagation();
    if (press.gesture) {
      // A press in empty space may publish an insert and then drag it: that
      // gesture starts from before the insert, so one undo removes both.
      start(press.entry, e, press.gesture, !press.claimed && press.edit ? before : snapshot());
      return;
    }
    if (press.edit) settleEdit(before, press.edit);
  }, [busy, start, makeCtx, snapshot, settleEdit, layers]);

  const onSvgKeyDown = useCallback((e: ReactKeyboardEvent<SVGSVGElement>) => {
    const step = historyEnabled ? historyKey(e) : null;
    if (step) {
      if (step === 'redo') redo();
      else undo();
      e.preventDefault();
      return;
    }
    const ctx = makeCtx(readModifiers(e));
    const ls = layers();
    for (let i = ls.length - 1; i >= 0; i--) {
      if (!ls[i].layer.onKeyDown) continue;
      const before = snapshot();
      const edit = offerKey(ls[i], e.nativeEvent, ctx);
      if (edit) settleEdit(before, edit);
      // The layer prevents default on the native event, which the synthetic
      // event's `isDefaultPrevented` does not observe.
      if (e.nativeEvent.defaultPrevented) return;
    }
  }, [historyEnabled, undo, redo, makeCtx, snapshot, settleEdit, layers]);

  const onSvgContextMenu = useCallback((
    e: ReactMouseEvent<SVGSVGElement>,
    coords: LayerPoint,
  ) => {
    if (busy()) return;
    const before = snapshot();
    const edit = dispatchContextMenu(layers(), coords, e.nativeEvent, makeCtx(readModifiers(e)));
    if (edit) settleEdit(before, edit);
  }, [busy, makeCtx, snapshot, settleEdit, layers]);

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
