/**
 * A `<Canvas>`'s view: held in a ref when uncontrolled, taken from the `view`
 * prop when controlled, with one `setView` and one subscriber list over both.
 */
import { useCallback, useRef, type MutableRefObject } from 'react';
import { useLatest } from '@weasel-js/react';
import type { Dims } from 'core/layers/render';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { clampView } from 'core/viewport/clampView';
import { normalizeView, type View } from 'core/viewport/view';

/** Inputs to {@link useCanvasView}: the canvas's view props and what a view
 *  write needs from the canvas around it. */
export interface CanvasViewOptions {
  view: View | undefined;
  defaultView: View | undefined;
  onViewChange: ((next: View) => void) | undefined;
  viewBounds: Bounds | undefined;
  dimsRef: { readonly current: Dims };
  requestRedraw: () => void;
}

/** What {@link useCanvasView} hands back. The canvas decides when in a commit
 *  the two controlled steps run, since they have to sit among its own effects. */
export interface CanvasViewState {
  /** The view in effect. Written by `setView` when uncontrolled and by
   *  `adoptControlled` when controlled. */
  viewRef: MutableRefObject<View>;
  /** The normalized `view` prop, or undefined when uncontrolled. */
  controlledView: View | undefined;
  setView: (next: View | ((current: View) => View)) => void;
  getView: () => View;
  subscribeView: (fn: (v: View) => void) => () => void;
  /** Take this render's controlled view into `viewRef`. Call from an insertion effect. */
  adoptControlled: () => void;
  /** Tell subscribers of a controlled view that moved since the last call.
   *  A controlled view reaches the ref with no `setView`, so this is where
   *  they hear of it. Call from a layout effect. */
  announceControlled: () => void;
  /** Drop every subscriber, on unmount. */
  clearSubscribers: () => void;
}

export function useCanvasView(opts: CanvasViewOptions): CanvasViewState {
  const { view: viewProp, defaultView, onViewChange, viewBounds, dimsRef, requestRedraw } = opts;
  // The uncontrolled view lives in a ref, not `useState`, so a camera moving
  // at 60 Hz costs no React render; DOM that mirrors it subscribes instead.
  const viewRef = useRef<View>(normalizeView(viewProp ?? defaultView ?? { x: 0, y: 0, scale: { x: 1, y: 1 } }));
  const isControlled = viewProp !== undefined;
  const controlledView = isControlled ? normalizeView(viewProp) : undefined;
  const viewSubsRef = useRef<Set<(v: View) => void>>(new Set());
  const onViewChangeRef = useLatest(onViewChange);
  const viewBoundsRef = useLatest(viewBounds);
  const isControlledRef = useLatest(isControlled);
  const controlledWarnedRef = useRef(false);

  const setView = useCallback((next: View | ((current: View) => View)) => {
    const resolved = normalizeView(typeof next === 'function' ? next(viewRef.current) : next);
    const bounds = viewBoundsRef.current;
    const clamped = bounds ? clampView(resolved, bounds, dimsRef.current) : resolved;
    if (isControlledRef.current) {
      // The prop is the authority; writing the ref would put pixels and props
      // out of step with nothing to reconcile them.
      const forward = onViewChangeRef.current;
      if (!controlledWarnedRef.current) {
        controlledWarnedRef.current = true;
        console.warn(forward
          ? '[weasel] setView not applied locally: this canvas is controlled by its `view` prop. The value was forwarded to `onViewChange` — update the prop from there, or drop it to take the imperative path.'
          : '[weasel] setView ignored: this canvas is controlled by its `view` prop and has no `onViewChange`, so the value has nowhere to go. Update the prop, or drop it to take the imperative path.');
      }
      forward?.(clamped);
      return;
    }
    viewRef.current = clamped;
    for (const fn of viewSubsRef.current) fn(clamped);
    onViewChangeRef.current?.(clamped);
    requestRedraw();
  }, [requestRedraw, dimsRef, isControlledRef, onViewChangeRef, viewBoundsRef]);

  const getView = useCallback(() => viewRef.current, []);
  const subscribeView = useCallback((fn: (v: View) => void) => {
    viewSubsRef.current.add(fn);
    return () => { viewSubsRef.current.delete(fn); };
  }, []);

  const controlledMovedRef = useRef(false);
  // A closure over this render's prop, not a ref read: the canvas calls it
  // from the same render's insertion effect.
  const adoptControlled = (): void => {
    if (!controlledView) return;
    const was = viewRef.current;
    controlledMovedRef.current ||= was.x !== controlledView.x || was.y !== controlledView.y
      || was.scale.x !== controlledView.scale.x || was.scale.y !== controlledView.scale.y;
    viewRef.current = controlledView;
  };
  const announceControlled = useCallback(() => {
    if (!controlledMovedRef.current) return;
    controlledMovedRef.current = false;
    for (const fn of viewSubsRef.current) fn(viewRef.current);
  }, []);
  const clearSubscribers = useCallback(() => { viewSubsRef.current.clear(); }, []);

  return {
    viewRef, controlledView, setView, getView, subscribeView,
    adoptControlled, announceControlled, clearSubscribers,
  };
}
