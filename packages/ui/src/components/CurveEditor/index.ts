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

export { attract as snapToNearest } from '@weasel-js/ui-logic';

export {
  LayeredCurveEditor,
  type LayeredCurveEditorProps,
  type LayerBinding,
} from './LayeredCurveEditor';

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

export {
  sampleByInterpolation,
  type InterpolationMode,
} from './interpolation';
export type { Point as CurveSamplePoint } from './catmullRom';
