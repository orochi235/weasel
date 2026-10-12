/** Reset seams and internals for tests in other packages; see `@weasel-js/text/test-seams`. */

export { getMesh, _resetCacheForTests } from './cache/cache';
export { _resetMarkerCommandCacheForTests } from './cache/markerCommandCache';
export { _resetOutlineMeshCacheForTests } from './cache/outlineMeshCache';
export { _resetOutlineStrokeMeshCacheForTests } from './cache/outlineStrokeMeshCache';
export { _resetStrokeMeshCacheForTests } from './cache/strokeMeshCache';
export { FLOATS_PER_VERTEX } from './drawBatch';
export { __setImageLoaderForTests, _resetImageCacheForTests } from './images/imageCache';
export { _resetPaintDrawKindsForTests } from './paintKinds';
export { _resetPatternSpecCacheForTests } from './patterns/resolveSpec';
export { _resetProgramRegistryForTests } from './shaders/registerProgram';
export { _resetTextureRegistryForTests } from './textures/registerTexture';
