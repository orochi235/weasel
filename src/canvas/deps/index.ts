/**
 * Per-dep wiring modules — extracted from `StandardActionsRegistrar` so each
 * kit-standard dep source lives in its own file. Consumers augmenting
 * `DepSchema` can use these as templates for their own dep modules.
 */
export { hitTestArea, hitTestAreaPolygon, type AABBBounds } from './hitTestArea';
export { useViewDepSource } from './view';
export { useAreaSelectDepSource } from './areaSelect';
export { useNodeAtPointDepSource } from './nodeAtPoint';
export { useLassoSelectDepSource } from './lassoSelect';
export { useTextEditDepSource } from './textEdit';
export { useEditAnchorsDepSource } from './editAnchors';
export { useInsertDepSource, type InsertNodeFactory } from './insert';
export { useDispatcherDepSource } from './dispatcher';
export {
  useResizePolicy,
  type UseResizePolicyOptions,
} from './resizePolicy';
export { useLayoutDepSource } from './layout';
export { useGeometryProjection } from './geometryProjection';
