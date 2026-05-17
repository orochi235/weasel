/**
 * Per-dep wiring modules — extracted from `StandardActionsRegistrar` so each
 * kit-standard dep source lives in its own file. Consumers augmenting
 * `DepSchema` can use these as templates for their own dep modules.
 */
export { hitTestAABB, type AABBBounds } from './aabbHitTest';
export { useViewDepSource } from './useViewDepSource';
export { useAreaSelectDepSource } from './useAreaSelectDepSource';
export { useLassoSelectDepSource } from './useLassoSelectDepSource';
export { useTextEditDepSource } from './useTextEditDepSource';
export { useEditAnchorsDepSource } from './useEditAnchorsDepSource';
export { useInsertDepSource } from './useInsertDepSource';
