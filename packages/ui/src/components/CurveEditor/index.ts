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
