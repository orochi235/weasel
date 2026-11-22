import {
  useCallback, useEffect, useMemo, useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { historyKey } from '@weasel-js/gestures';
import { deepEqual } from '@weasel-js/registry';
import {
  Plot2D,
  type Plot2DHandle,
  type GridSettings,
  type AxesSettings,
  type TickSettings,
} from '../Plot2D';
import { dlog } from '../../dlog';
import s from './CurveEditor.module.css';
import { dispatchContextMenu, dispatchKey, dispatchPress, type LayerEdit, type LayerPoint } from './layerDispatch';
import { LayerHostContext, settleLayer, useLayerRegistry, type LayerHost } from './layerHost';
import { readModifiers, usePlotLayerCtx } from './layerCtx';
import type { HoldProps } from '../Disabled';
import { useControlHold } from '../Disabled/controlHold';
import { useLayerHistory, type LayerSnapshot } from './useLayerHistory';
import { useLayerGesture } from './useLayerGesture';

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

  const { ctxFor: makeCtx, base: renderCtxBase } = usePlotLayerCtx(xRange, yRange, width, height);
  const { register, layers } = useLayerRegistry();
  const plotRef = useRef<Plot2DHandle | null>(null);

  const { snapshot, record, undo, redo } = useLayerHistory(layers);

  /** Report a finished one-shot edit, as one undo step back to `before`; one that changed nothing settles unchanged. */
  const settleEdit = useCallback((before: LayerSnapshot, edit: LayerEdit) => {
    if (deepEqual(edit.next, edit.prev)) { settleLayer(edit.entry, 'unchanged'); return; }
    if (historyEnabled) record(before);
    settleLayer(edit.entry, { commit: edit.next, prev: edit.prev });
  }, [historyEnabled, record]);

  const { start, busy, cancel, activeEntry } = useLayerGesture({
    toModel: (e) => plotRef.current?.clientToModel(e) ?? null,
    ctxFor: makeCtx,
    layers,
    onEdit: (before) => { if (historyEnabled) record(before); },
  });

  // A hold that starts mid-drag ends the drag, as it would refuse the press that began it.
  useEffect(() => { if (hold.refuses) cancel(); }, [hold.refuses, cancel]);

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
      start(press.entry, e, press.gesture, !press.claimed && press.edit ? before : snapshot(), press.edit ? { state: press.edit.next } : undefined);
      return;
    }
    if (press.edit) settleEdit(before, press.edit);
  }, [busy, start, makeCtx, snapshot, settleEdit, layers]);

  const onSvgKeyDown = useCallback((e: ReactKeyboardEvent<SVGSVGElement>) => {
    // A drag in flight owns the edit until it ends; Escape reaches its session, which cancels it.
    if (busy()) return;
    const step = historyEnabled ? historyKey(e) : null;
    if (step) {
      if (step === 'redo') redo();
      else undo();
      e.preventDefault();
      return;
    }
    // A layer prevents default on the native event, which the synthetic
    // event's `isDefaultPrevented` does not observe.
    dispatchKey(layers(), e.nativeEvent, makeCtx(readModifiers(e)), (made) => {
      const snap = snapshot();
      for (const edit of made) snap.set(edit.entry, edit.next);
      return snap;
    }, settleEdit);
  }, [busy, historyEnabled, undo, redo, makeCtx, snapshot, settleEdit, layers]);

  const onSvgContextMenu = useCallback((
    e: ReactMouseEvent<SVGSVGElement>,
    coords: LayerPoint,
  ) => {
    // A long press opens a menu after its pointerdown has started a drag; the menu wins, as from where the drag began.
    if (busy()) flushSync(cancel);
    const before = snapshot();
    const edit = dispatchContextMenu(layers(), coords, e.nativeEvent, makeCtx(readModifiers(e)));
    if (edit) settleEdit(before, edit);
  }, [busy, cancel, makeCtx, snapshot, settleEdit, layers]);

  // ── render ─────────────────────────────────────────────────────────
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
      tabIndex={hold.tabIndex(0)}
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
