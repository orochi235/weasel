/**
 * Re-exports of detached scene-view + minimap primitives from
 * `@orochi235/weasel` so consumers reach them through
 * `@labkit/react/weasel-canvas` rather than depending on the weasel
 * canvas package directly. This passthrough is narrow on purpose —
 * weasel's full surface is engine-sized, and we only widen as labs
 * demand it.
 */
export {
  SceneViewCanvas,
  type SceneViewCanvasProps,
  MinimapCanvas,
  type MinimapCanvasProps,
  buildSceneViewCommands,
  renderSceneToCanvas,
  type SceneViewDrawOne,
  FALLBACK_FIT_VIEW,
  computeFitView,
  computeIndicatorCommand,
  type ComputeFitViewOptions,
  type IndicatorStyle,
  type MinimapFit,
} from '@orochi235/weasel';
