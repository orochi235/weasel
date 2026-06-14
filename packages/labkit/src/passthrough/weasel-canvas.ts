/**
 * Re-exports of detached scene-view + minimap primitives from
 * `@weasel-js/core` so consumers reach them through
 * `@weasel-js/labkit/weasel-canvas` rather than depending on the weasel
 * canvas package directly. This passthrough is narrow on purpose —
 * weasel's full surface is engine-sized, and we only widen as labs
 * demand it.
 */
export {
  buildSceneViewCommands,
  type ComputeFitViewOptions,
  computeFitView,
  computeIndicatorCommand,
  FALLBACK_FIT_VIEW,
  type IndicatorStyle,
  MinimapCanvas,
  type MinimapCanvasProps,
  type MinimapFit,
  renderSceneToCanvas,
  SceneViewCanvas,
  type SceneViewCanvasProps,
  type SceneViewDrawOne,
} from '@weasel-js/core';
