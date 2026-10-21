/**
 * A `<CanvasView>`'s camera and its aim, whichever of the two the view holds.
 * A camera-held view answers its aim from its camera; an aim-held one derives
 * its camera from the aim, through the same thunk a derived `view` uses.
 */
import { useCallback } from 'react';
import { useLatest } from '@weasel-js/react';
import type { Dims } from 'core/layers/render';
import { normalizeView, type View } from 'core/viewport/view';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { viewportWorldRect } from 'core/viewport/viewportWorldRect';
import { isRectAim, rectAim, viewForAim, type ViewAim } from 'features/viewports/aim';
import { useCanvasView, type CanvasViewState } from './useCanvasView';
import type { CanvasViewProps, ViewRect } from './canvasViewProps';
import { sizeOf, type useViewNesting } from './useViewNesting';
import { IDENTITY_VIEW, UNMEASURED_DIMS, type ViewRegistry } from './viewRegistry';

/** `held` carried by the camera move that turns the world rect `from` into `to`: panned and scaled
 *  with it, so the aim keeps its own shape rather than taking the frame's. */
function carried(held: Bounds, from: Bounds, to: Bounds): Bounds {
  const kx = from.width > 0 ? to.width / from.width : 1;
  const ky = from.height > 0 ? to.height / from.height : 1;
  return {
    x: to.x + (held.x - from.x) * kx,
    y: to.y + (held.y - from.y) * ky,
    width: held.width * kx,
    height: held.height * ky,
  };
}

type Nesting = ReturnType<typeof useViewNesting>;

export function useViewAim(args: {
  props: Pick<CanvasViewProps, 'view' | 'defaultView' | 'onViewChange' | 'viewBounds' | 'aim' | 'onAimChange'>;
  id: string;
  registry: ViewRegistry | null;
  derivedAt: Nesting['derivedAt'];
  rectAt: Nesting['rectAt'];
  rectNow: () => ViewRect;
}): CanvasViewState & {
  held: 'camera' | 'aim';
  aim(): ViewAim;
  setAim(aim: ViewAim): boolean;
  /** The camera for a frame the caller names. A derived camera is asked for that frame; any other is
   *  the same whatever the surface is doing. */
  cameraAt(outer: View, dims: Dims): View;
} {
  const { props, id, registry, derivedAt, rectAt, rectNow } = args;
  const { view, defaultView, onViewChange, viewBounds, aim: aimProp, onAimChange } = props;
  const held = aimProp !== undefined ? 'aim' : 'camera';
  const live = useLatest({ view, aimProp, onAimChange });

  /** The rect an aim-held view holds, for a surface frame. */
  const heldAt = useCallback((outer: View, dims: Dims): Bounds | undefined => {
    const a = live.current.aimProp;
    return typeof a === 'function' ? derivedAt(a, outer, dims) : a;
  }, [live, derivedAt]);

  /** The camera derived for a surface frame, or `undefined` for a camera the view keeps. */
  const derivedCamera = useCallback((outer: View, dims: Dims): View | undefined => {
    const rect = heldAt(outer, dims);
    if (rect) return viewForAim(rect, sizeOf(rectAt(outer, dims)), 'contain');
    const v = live.current.view;
    return typeof v === 'function' ? normalizeView(derivedAt(v, outer, dims)) : undefined;
  }, [live, heldAt, rectAt, derivedAt]);

  const surfaceFrame = useCallback((): [View, Dims] => {
    const surface = registry?.surface();
    return [surface?.view() ?? IDENTITY_VIEW, surface?.dims() ?? UNMEASURED_DIMS];
  }, [registry]);

  /** A camera write on an aim-held view, reported as the held rect it carries. */
  const reportWrite = useCallback((next: View): void => {
    const frame = surfaceFrame();
    const held = heldAt(...frame);
    const current = derivedCamera(...frame);
    if (!held || !current) return;
    const size = sizeOf(rectAt(...frame));
    live.current.onAimChange?.(carried(held, viewportWorldRect(current, size), viewportWorldRect(next, size)));
  }, [live, surfaceFrame, heldAt, derivedCamera, rectAt]);

  const state = useCanvasView({
    view: held === 'aim' || typeof view === 'function' ? () => derivedCamera(...surfaceFrame())! : view,
    defaultView,
    onViewChange: held === 'aim'
      ? onAimChange && reportWrite
      : onViewChange,
    viewBounds,
    dims: () => sizeOf(rectNow()),
    requestRedraw: () => registry?.surface()?.requestRedraw(),
    controlledBy: held === 'aim' ? 'aim' : 'view',
  });
  const { getView, setViewFromInput } = state;

  const aim = useCallback((): ViewAim => {
    const rect = heldAt(...surfaceFrame());
    return rectAim(id, rect ?? viewportWorldRect(getView(), sizeOf(rectNow())));
  }, [id, heldAt, surfaceFrame, getView, rectNow]);

  const setAim = useCallback((next: ViewAim): boolean => {
    if (!isRectAim(next)) return false;
    const { aimProp: a, onAimChange: report } = live.current;
    if (a === undefined) {
      setViewFromInput(viewForAim(next.extent, sizeOf(rectNow()), 'exact'));
      return true;
    }
    report?.(next.extent);
    return report !== undefined;
  }, [live, setViewFromInput, rectNow]);

  const cameraAt = useCallback(
    (outer: View, dims: Dims): View => derivedCamera(outer, dims) ?? getView(),
    [derivedCamera, getView],
  );

  return { ...state, held, aim, setAim, cameraAt };
}
