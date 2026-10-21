/**
 * A camera: held in a ref when uncontrolled, taken from the `view` option when
 * controlled, with one write path and one subscriber list over both.
 * `<SceneCanvas>` makes the one its `<Canvas>` looks through, and each
 * `<CanvasView>` makes its own.
 */
import { useCallback, useRef, type MutableRefObject } from 'react';
import { useLatest } from '@weasel-js/react';
import type { Dims } from 'core/layers/render';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { clampView } from 'core/viewport/clampView';
import { normalizeView, sameView, type View } from 'core/viewport/view';

/** The view props a canvas takes for its camera. */
export interface CameraProps {
  /** Controlled viewport. When supplied, the canvas does not own the value —
   *  the consumer must supply `onViewChange` and re-render with the new
   *  view. See `View` JSDoc for the camera-position convention. */
  view?: View;
  /** Initial viewport for the uncontrolled path. Default `{x:0, y:0}`. */
  defaultView?: View;
  /** Fires whenever the viewport changes — in both controlled and
   *  uncontrolled modes. */
  onViewChange?: (next: View) => void;
  /**
   * Optional world-space rect that constrains pan: every write to the view passes through
   * `clampView` first, keeping the visible rect inside `viewBounds`. An axis where the
   * visible rect is larger than the bounds is centered. Has no effect on `scale`.
   */
  viewBounds?: { x: number; y: number; width: number; height: number };
}

/** Inputs to {@link useCanvasView}: the camera's view props and what a write
 *  needs from whatever the camera looks through. */
export interface CanvasViewOptions {
  /** Supplied, the camera is controlled. A thunk is a camera derived from
   *  something else, read fresh at every {@link CanvasViewState.getView}. */
  view: View | (() => View) | undefined;
  defaultView: View | undefined;
  onViewChange: ((next: View) => void) | undefined;
  viewBounds: Bounds | undefined;
  /** The size the camera looks through, which `viewBounds` clamps against. */
  dims: () => Dims;
  requestRedraw: () => void;
  /** The prop a controlled camera answers to, which a warning names. Default `'view'`. */
  controlledBy?: 'view' | 'aim';
}

/** What `useCanvasView` hands back. The owner decides when in a commit
 *  the two controlled steps run, since they have to sit among its own effects. */
export interface CanvasViewState {
  /** The view in effect. Written by a write when uncontrolled and by
   *  `adoptControlled` when controlled. A camera derived by a thunk is not
   *  kept here: read `getView`. */
  viewRef: MutableRefObject<View>;
  /** This render's controlled view, absent when the camera is uncontrolled or
   *  derived. A new object every render, so compare its numbers. */
  controlled: View | undefined;
  /** The imperative write. Controlled, it is forwarded to `onViewChange`
   *  instead of applied, and says so once per mount. */
  setView: (next: View | ((current: View) => View)) => void;
  /** The write input makes. Controlled, forwarding it to `onViewChange` is how
   *  the owner hears of a pan at all, so nothing is warned. */
  setViewFromInput: (next: View) => void;
  getView: () => View;
  subscribeView: (fn: (v: View) => void) => () => void;
  /** Take this render's controlled view into `viewRef`. Call from an insertion effect. */
  adoptControlled: () => void;
  /** Tell subscribers of a controlled view that moved since the last call.
   *  A controlled view reaches the ref with no write, so this is where they
   *  hear of it. Call from a layout effect. */
  announceControlled: () => void;
  /** Drop every subscriber, on unmount. */
  clearSubscribers: () => void;
}

const IDENTITY: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

export function useCanvasView(opts: CanvasViewOptions): CanvasViewState {
  const { view: viewProp, defaultView, onViewChange, viewBounds, dims, requestRedraw } = opts;
  const derived = typeof viewProp === 'function' ? viewProp : undefined;
  const controlledView = viewProp === undefined || derived ? undefined : normalizeView(viewProp as View);
  // The uncontrolled view lives in a ref, not `useState`, so a camera moving
  // at 60 Hz costs no React render; DOM that mirrors it subscribes instead.
  const viewRef = useRef<View>(controlledView ?? normalizeView(defaultView ?? IDENTITY));
  const viewSubsRef = useRef<Set<(v: View) => void>>(new Set());
  const live = useLatest({
    controlled: viewProp !== undefined, derived, onViewChange, viewBounds, dims, requestRedraw,
    by: opts.controlledBy ?? 'view',
  });
  const controlledWarnedRef = useRef(false);

  const getView = useCallback((): View => {
    const thunk = live.current.derived;
    return thunk ? normalizeView(thunk()) : viewRef.current;
  }, [live]);

  const write = useCallback((next: View, imperative: boolean): void => {
    const {
      controlled, derived, onViewChange: forward, viewBounds: bounds, dims: size, requestRedraw: redraw,
    } = live.current;
    const valid = normalizeView(next);
    const clamped = bounds ? clampView(valid, bounds, size()) : valid;
    if (controlled) {
      // The prop is the authority; writing the ref would put pixels and props
      // out of step with nothing to reconcile them.
      if (imperative && !controlledWarnedRef.current) {
        controlledWarnedRef.current = true;
        const [prop, cb] = live.current.by === 'aim' ? ['aim', 'onAimChange'] : ['view', 'onViewChange'];
        console.warn(forward
          ? `[weasel] setView not applied locally: this canvas is controlled by its \`${prop}\` prop. The value was forwarded to \`${cb}\` — update the prop from there, or drop it to take the imperative path.`
          : `[weasel] setView ignored: this canvas is controlled by its \`${prop}\` prop and has no \`${cb}\`, so the value has nowhere to go. Update the prop, or drop it to take the imperative path.`);
      }
      forward?.(clamped);
      // A derived camera has no prop to change, so nothing else repaints it.
      if (derived) redraw();
      return;
    }
    viewRef.current = clamped;
    for (const fn of viewSubsRef.current) fn(clamped);
    forward?.(clamped);
    redraw();
  }, [live]);

  const setView = useCallback((next: View | ((current: View) => View)) => {
    write(typeof next === 'function' ? next(getView()) : next, true);
  }, [write, getView]);
  const setViewFromInput = useCallback((next: View) => { write(next, false); }, [write]);

  const subscribeView = useCallback((fn: (v: View) => void) => {
    viewSubsRef.current.add(fn);
    return () => { viewSubsRef.current.delete(fn); };
  }, []);

  const controlledMovedRef = useRef(false);
  // A closure over this render's prop, not a ref read: the owner calls it
  // from the same render's insertion effect.
  const adoptControlled = (): void => {
    if (!controlledView) return;
    controlledMovedRef.current ||= !sameView(viewRef.current, controlledView);
    viewRef.current = controlledView;
  };
  const announceControlled = useCallback(() => {
    if (!controlledMovedRef.current) return;
    controlledMovedRef.current = false;
    for (const fn of viewSubsRef.current) fn(viewRef.current);
  }, []);
  const clearSubscribers = useCallback(() => { viewSubsRef.current.clear(); }, []);

  return {
    viewRef, controlled: controlledView, setView, setViewFromInput, getView, subscribeView,
    adoptControlled, announceControlled, clearSubscribers,
  };
}
