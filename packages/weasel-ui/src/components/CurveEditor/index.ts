export {
  CurveEditor,
  type CurveEditorProps,
  type ControlPoint,
  type CurveDomain,
  type EndpointMode,
  type AddPointMode,
  type FillSettings,
  type AnchorRenderProps,
} from './CurveEditor';
// GridSettings / AxesSettings now live on Plot2D — import them from
// `@orochi235/weasel-ui` (or `./Plot2D`) rather than re-exporting here
// and creating an ambiguous `export *` at the package root.

export {
  createSetCurveOp,
  type SetCurveAdapter,
  type CreateSetCurveOpArgs,
} from './setCurveOp';

export {
  sampleByInterpolation,
  type InterpolationMode,
} from './interpolation';
