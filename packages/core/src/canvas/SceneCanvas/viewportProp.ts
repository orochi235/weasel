import type { InertiaConfig } from 'core/viewport/useDecayLoop';
import type { View } from 'core/viewport/view';
import type { PinchZoomOptions } from 'interactions/actions/defaults/pinchZoom';
import type { WheelPanOptions } from 'interactions/actions/defaults/viewportWheelPan';
import type { ViewportZoomAnimateOptions, ViewportZoomOptions } from 'interactions/actions/defaults/viewportZoom';

/** `<SceneCanvas viewport>`: configures the `view` preset, and implies
 *  it: passing this turns `view` on.
 *
 *  - `inertia` and `animatedZoom` are opt-in: pass `true` for defaults or
 *    an object to tune. Omitted means off.
 *  - `pan` (wheel pan), `zoom` (Cmd+wheel + Cmd+=/-/0), and `pinchZoom`
 *    (two-finger pinch) are on under `view`; pass `false` to disable one.
 *    Disabling via the `actions` prop
 *    (`actions: { 'viewport.wheelPan': null }`) also works and runs after
 *    this. */
export interface SceneCanvasViewport {
  inertia?: boolean | InertiaConfig;
  /** Two-finger pinch zoom. `true`/omitted = on with the kit's 0.1–8
   *  clamp; `false` disables. An object sets the scale clamp and holds the
   *  zoom to one axis (`axis`). */
  pinchZoom?: boolean | PinchZoomOptions;
  /** Glide Cmd+=/-/0 instead of jumping. `true` uses the kit defaults
   *  (250 ms, ease-out-cubic); a {@link ViewportZoomAnimateOptions} tunes
   *  duration, easing, interpolator and the reset-branch duration. Wheel
   *  and pinch are unaffected — their input already samples every frame. */
  animatedZoom?: boolean | ViewportZoomAnimateOptions;
  /** Wheel pan. `true`/omitted = on; `false` disables; an object locks the
   *  axis (`{ axis: 'x' }`) so a single-axis viewport needs no commit clamp. */
  pan?: boolean | WheelPanOptions;
  /** Wheel/keyboard zoom. `true`/omitted = default Cmd+wheel zoom with the
   *  kit's 0.1–8 clamp; `false` disables. Pass a {@link ViewportZoomOptions}
   *  object to bind zoom to plain wheel (`wheel: 'plain'`, pair with
   *  `pan: false`), set `min`/`max` scale clamps, or hold the zoom to one
   *  axis (`axis: 'x'`). */
  zoom?: boolean | ViewportZoomOptions;
  /** Callback invoked by Cmd-0 (`viewport.zoom` action's `reset` branch).
   *  When supplied, replaces the default reset-to-identity behavior —
   *  consumers typically refit the document page into the workspace via
   *  `fitViewToBounds`. Return the target `View` to let the kit animate
   *  there when `animatedZoom` is on; return nothing to dispatch it
   *  yourself, which is what a controlled canvas does. */
  recenter?: () => View | void;
}
