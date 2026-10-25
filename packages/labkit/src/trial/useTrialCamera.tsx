import { type Camera3d, clampCamera, createCamera } from '@weasel-js/kernel3d';
import { type ReactNode, type RefObject, useContext, useMemo, useRef, useState } from 'react';
import { type CameraGestures, CameraGesturesContext } from '../canvas/cameraGestures';
import { clientSize, layoutSize } from '../canvas/hostBox';
import { Orbit } from '../canvas/Orbit';
import { orbitZoomView } from '../canvas/orbitZoom';
import { Stage } from '../canvas/Stage';
import type { Instrument, RenderContext, ViewTransform } from '../instrument/types';
import { useIsPresented } from '../lab/presentation';
import { as2DView, as3DView, DEFAULT_VIEW, withZoom } from '../state/view';
import { cameraOf, type InstrumentCamera } from './homeView';
import type { TrialOrbit } from './useTrialOrbit';
import { useViewPlacement, type ViewPlacement } from './useViewPlacement';

interface TrialCameraOptions {
  instrument: Instrument;
  trialId: string;
  view: unknown;
  setView: (view: unknown) => void;
  /** The element a `canvas` camera fills; the others bring their own. */
  canvasHost: RefObject<HTMLDivElement | null>;
}

/** A trial's camera, whichever kind its instrument declares. */
export interface TrialCamera {
  camera: InstrumentCamera;
  /** The view as a 2D camera reads it, or `null` when it holds another shape. */
  view2d: ViewTransform | null;
  /** The instrument's gestures under the lab's. */
  gestures: CameraGestures;
  placement: ViewPlacement;
  /** Returns the camera to where it opened. */
  home: () => void;
  /** As `RenderContext.trial.zoom`. */
  zoom: number;
  setZoom: (zoom: number) => void;
  /** What `useTrialOrbit` reads; `null` unless the camera is an orbit. */
  orbit: TrialOrbit | null;
  /** A `stage` or `orbit` camera around `content`, drawing its capability's
   *  overlay from `ctx`; `null` for the others, which the trial lays out itself. */
  body: (content: ReactNode, ctx: RenderContext) => ReactNode | null;
}

const STILL: CameraGestures = { drag: false, wheel: false, pinch: false, tap: false, home: false };

/**
 * Everything a trial does with its camera that does not depend on which kind
 * it is: placement, the `home` gesture, the zoom it reports, and the orbit
 * handle. A 2D view and an orbit are both read out of the trial's opaque
 * `view` here and nowhere else in `<Trial>`.
 */
export function useTrialCamera({
  instrument,
  trialId,
  view,
  setView,
  canvasHost,
}: TrialCameraOptions): TrialCamera {
  const camera = cameraOf(instrument);
  const cameraHost = useRef<HTMLDivElement | null>(null);
  // The pane an orbit's instrument draws in, when it names one.
  const [pane, setPane] = useState<HTMLElement | null>(null);
  const measured = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return pane ?? cameraHost.current;
      },
    }),
    [pane],
  );
  const labGestures = useContext(CameraGesturesContext);
  const gestures =
    camera?.kind === 'orbit' && camera.capability.fixed
      ? STILL
      : { ...camera?.capability.gestures, ...labGestures };
  const placement = useViewPlacement({
    instrument,
    view,
    setView,
    presented: useIsPresented(trialId),
    viewport: camera?.kind === 'canvas' ? canvasHost : measured,
    measure: camera?.kind === 'orbit' ? clientSize : layoutSize,
  });
  const home = (): void => {
    const placed = placement.home();
    if (placed != null) setView(placed);
  };

  const view2d = as2DView(view);
  const orbitCap = camera?.kind === 'orbit' ? camera.capability : null;
  // A trial whose view is not yet placed shows a stand-in until it is measured.
  const view3d = orbitCap ? as3DView(view, orbitCap.limits) : null;
  const orbitHome = (): Camera3d | null =>
    orbitCap ? as3DView(placement.home(), orbitCap.limits) : null;
  const orbitZoom = orbitCap
    ? orbitZoomView({
        get: () => view3d ?? createCamera({}),
        set: setView,
        home: orbitHome,
        limits: () => orbitCap.limits ?? {},
        hostSize: () => null,
      })
    : null;

  // Rebuilt each render: whatever reads it renders inside the trial, which
  // renders again on every change to the view anyway.
  const orbit: TrialOrbit | null = orbitCap
    ? {
        camera: view3d,
        setCamera: (next) => setView(clampCamera(next, orbitCap.limits)),
        home: () => {
          const placed = orbitHome();
          if (placed) setView(placed);
        },
        viewportRef: setPane,
      }
    : null;

  return {
    camera,
    view2d,
    gestures,
    placement,
    home,
    zoom: view2d?.zoom ?? (view3d && orbitZoom ? orbitZoom.get().scale.x : 1),
    setZoom: (z) => {
      if (view2d) setView(withZoom(view2d, z));
      else if (view3d) orbitZoom?.set({ x: 0, y: 0, scale: { x: z, y: z } });
    },
    orbit,
    body: (content, ctx) => {
      if (camera?.kind === 'stage') {
        const stage = camera.capability;
        return (
          <Stage
            size={stage.size}
            view={view2d ?? DEFAULT_VIEW}
            onViewChange={setView}
            onResize={placement.place}
            hostRef={cameraHost}
            gestures={gestures}
            onHome={home}
            minZoom={stage.minZoom}
            maxZoom={stage.maxZoom}
            overlay={stage.overlay?.(ctx)}
          >
            {content}
          </Stage>
        );
      }
      if (orbitCap) {
        return (
          <Orbit
            view={view3d ?? createCamera({})}
            onViewChange={setView}
            limits={orbitCap.limits}
            home={orbitHome}
            viewport={pane}
            onResize={placement.place}
            hostRef={cameraHost}
            gestures={gestures}
            overlay={orbitCap.overlay?.(ctx)}
          >
            {content}
          </Orbit>
        );
      }
      return null;
    },
  };
}
