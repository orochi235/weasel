export {
  CurveEditor,
  type CurveEditorProps,
} from './CurveEditor';

export {
  type ControlPoint,
  type CurveDomain,
  type EndpointMode,
  type AddPointMode,
  type FillSettings,
  type CurveSettings,
  type AnchorRenderProps,
  createFunctionLayer,
  functionLayerState,
  type FunctionLayerConfig,
  type FunctionLayerState,
} from './createFunctionLayer';

export {
  createKeyframeLayer,
  keyframeLayerState,
  applyKeyframeDrag,
  type KeyframeDrag,
  type KeyframeDragResult,
  type KeyframeLayerConfig,
  type KeyframeLayerState,
} from './createKeyframeLayer';

export { attract as snapToNearest } from '@weasel-js/ui-input';

export {
  LayeredCurveEditor,
  type LayeredCurveEditorProps,
} from './LayeredCurveEditor';

export { FunctionLayer, type FunctionLayerProps } from './FunctionLayer';
export { KeyframeLayer, type KeyframeLayerProps } from './KeyframeLayer';
export { CustomLayer, type CustomLayerProps, type LayerStateProps } from './CustomLayer';

export type {
  CurveLayer,
  LayerCtx,
  LayerRenderCtx,
  LayerHit,
  LayerGesture,
  LayerModifiers,
  EmptyDownArgs,
  KeyDownArgs,
  ModelPoint,
  PlotPoint,
} from './layerTypes';

export {
  createSetCurveOp,
  type SetCurveAdapter,
  type CreateSetCurveOpArgs,
} from './setCurveOp';


export { POINT_PLOTTER_PROPS } from './presets';
