/**
 * The consumer-facing `viewport` prop shape for `<SceneCanvas>`.
 *
 * The features it names are wired by the `viewport.*` action descriptors
 * (`useStandardActions` + `useGestureDispatcher`) and by SceneCanvas itself,
 * which derives the hand tool and the registered flag inline.
 */
import type { PanBounds } from 'core/viewport/useDecayLoop';
import type { ViewportZoomOptions } from 'interactions/actions/defaults/viewportZoom';

/** Which viewport interactions `<SceneCanvas>` wires up — pan inertia, pinch
 *  zoom, wheel pan, wheel and keyboard zoom. Each may be switched off with
 *  `false` or tuned with an options object. */
export interface ViewportConfig {
  inertia?:
    | boolean
    | { friction?: number; minSpeed?: number; boundary?: 'stop' | 'bounce' | 'spring'; bounds?: PanBounds };
  pinchZoom?: boolean | { min?: number; max?: number };
  /** Wheel pan (plain wheel → pan). Default: `true`. Set `false` to disable. */
  pan?: boolean;
  /** Wheel + keyboard zoom (Cmd+wheel, Cmd+=/-/0). Default: `true`. Set `false`
   *  to disable, or pass a {@link ViewportZoomOptions} object to tune the wheel
   *  trigger + scale clamp. */
  zoom?: boolean | ViewportZoomOptions;
}
