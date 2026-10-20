/**
 * Per-dep wiring modules — extracted from `useSceneStandardActions` so each
 * kit-standard dep source lives in its own file. Consumers augmenting
 * `DepSchema` can use these as templates for their own dep modules.
 *
 * @packageDocumentation
 */
export { hitTestArea, hitTestAreaPolygon, type AABBBounds } from './hitTestArea';
export { useViewDepSource } from './view';
export { useAreaSelectDepSource } from './areaSelect';
export { useNodeAtPointDepSource } from './nodeAtPoint';
export { useLassoSelectDepSource } from './lassoSelect';
export { useTextEditDepSource } from './textEdit';
export { useEditAnchorsDepSource } from './editAnchors';
export { paletteInsertPaint, useInsertDepSource, type InsertNodeFactory, type InsertPaint } from './insert';
export { useSnapDepSource } from './snap';
export { useTransformFollower } from './transformFollowers';
export { useSliceDep, useSliceDepSource } from './slice';
export { useBooleansAdapterSource } from './booleans';
export { usePathLeafDepSources } from './pathLeafDeps';
export { useDebugDepSource } from './debug';
export { usePreviewPathsDepSource, createPreviewPaths, PREVIEW_PATHS_LAYER_ID, type PreviewPathsDep } from './previewPaths';
export { useSurfaceDepSources } from './surface';
export { useKitSettingsDepSource } from './kitSettings';
export { useDepChangeNotices } from './changes';
export { useDispatcherDepSource } from './dispatcher';
export {
  useResizePolicy,
  resizePolicyOptions,
  type UseResizePolicyOptions,
} from './resizePolicy';
export { usePoseDescriptorDepSource } from './poseDescriptor';
export { useLayoutDepSource } from './layout';
export { useGeometryProjection } from './geometryProjection';
export { useIngestionDepSource } from './ingestion';
