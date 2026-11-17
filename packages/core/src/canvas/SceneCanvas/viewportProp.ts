import type { InertiaOptions } from 'core/viewport/useDecayLoop';
import type { View } from 'core/viewport/view';
import type { EdgePanOptions } from './useEdgePan';
import type { TouchZoomOptions } from 'interactions/actions/defaults/touchZoom';
import type { ViewportWheelPanOptions } from 'interactions/actions/defaults/viewportWheelPan';
import type { ViewportZoomAnimateOptions, ViewportZoomOptions } from 'interactions/actions/defaults/viewportZoom';

/** `<SceneCanvas viewport>`: configures the navigation `viewPreset` turns
 *  on. It implies nothing: without `viewPreset` (or a preset including it,
 *  such as `drawPreset`) the canvas does not pan or zoom, whatever this
 *  says, and a development build warns.
 *
 *  - `inertia` and `animatedZoom` are opt-in: pass `true` for defaults or
 *    an object to tune. Omitted means off.
 *  - `pan` (wheel pan), `zoom` (Cmd+wheel + Cmd+=/-/0), and `touchZoom`
 *    (two-finger pinch) are on under `viewPreset`; pass `false` to disable one.
 *    Disabling via the `actions` prop
 *    (`actions: { 'viewport.wheelPan': null }`) also works and runs after
 *    this. */
export interface SceneCanvasViewport {
  inertia?: boolean | InertiaOptions;
  /** Two-finger pinch zoom. `true`/omitted = on with the kit's 0.1–8
   *  clamp; `false` disables. An object sets the scale clamp and holds the
   *  zoom to one axis (`axis`). */
  touchZoom?: boolean | TouchZoomOptions;
  /** Glide Cmd+=/-/0 instead of jumping. `true` uses the kit defaults
   *  (250 ms, ease-out-cubic); a {@link ViewportZoomAnimateOptions} tunes
   *  duration, easing, interpolator and the reset-branch duration. Wheel
   *  and pinch are unaffected — their input already samples every frame. */
  animatedZoom?: boolean | ViewportZoomAnimateOptions;
  /** Wheel pan. `true`/omitted = on; `false` disables; an object locks the
   *  axis (`{ axis: 'x' }`) so a single-axis viewport needs no commit clamp. */
  pan?: boolean | ViewportWheelPanOptions;
  /** Wheel/keyboard zoom. `true`/omitted = default Cmd+wheel zoom with the
   *  kit's 0.1–8 clamp; `false` disables. Pass a {@link ViewportZoomOptions}
   *  object to bind zoom to plain wheel (`wheel: 'plain'`, pair with
   *  `pan: false`), set `min`/`max` scale clamps, or hold the zoom to one
   *  axis (`axis: 'x'`). */
  zoom?: boolean | ViewportZoomOptions;
  /** Callback invoked by Cmd-0 (`viewport.zoom` action's `reset` branch).
   *  When supplied, replaces the default reset to `HOME_VIEW` —
   *  consumers typically refit the document page into the workspace via
   *  `fitViewToBounds`. Return the target `View` to let the kit animate
   *  there when `animatedZoom` is on; return nothing to dispatch it
   *  yourself, which is what a controlled canvas does. */
  recenter?: () => View | void;
  /** Scroll the view while a drag of content holds the pointer near the
   *  canvas's edge: a move, resize, insert, or marquee. On under `viewPreset`;
   *  `false` disables; an object sets the zone and the speed. */
  edgePan?: boolean | EdgePanOptions;
}
