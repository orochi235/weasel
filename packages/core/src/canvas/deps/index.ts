/**
 * Per-dep wiring modules — extracted from `useSceneStandardActions` so each
 * kit-standard dep source lives in its own file. Consumers augmenting
 * `DepSchema` can use these as templates for their own dep modules.
 *
 * @packageDocumentation
 */
export { hitTestRect, hitTestAreaPolygon, type AabbBounds } from './hitTestArea';
export { useViewDepSource } from './view';
export { useNodeAtPointDepSource } from './nodeAtPoint';
export { useEditAnchorsDepSource } from './editAnchors';
export { useSelectionSnapshotDepSource } from './selectionSnapshot';
export type { InsertNodeFactory, InsertNodeFactories, InsertedNode, KitInsertKind } from './insertFactories';
export { useSnapDepSource } from './snap';
export { useTransformFollower } from './transformFollowers';
export { useSliceDepSource } from './slice';
export { useDebugDepSource } from './debug';
export { usePreviewPathsDepSource, createPreviewPaths, PREVIEW_PATHS_LAYER_ID, type PreviewPathsDep } from './previewPaths';
export { useSurfaceDepSources } from './surface';
export { useKitSettingsDepSource } from './kitSettings';
export { useDepChangeNotices } from './changes';
export { useDispatcherDepSource } from './dispatcher';
export { usePoseDescriptorDepSource } from './poseDescriptor';
export { useLayoutDepSource } from './layout';
export { useGeometryProjection } from './geometryProjection';
export { useIngestionDepSource } from './ingestion';
export { createEnteredGroup, useEnteredGroup, useEnteredGroupApiSource, type EnteredGroupApi } from './enteredGroup';
export { useColorAtDepSource, type ColorAtSource } from './colorAt';
export { useLiveOperands } from './operands';
