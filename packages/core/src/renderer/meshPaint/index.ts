/**
 * The mesh-gradient paint kind, published as `@weasel-js/core/mesh`, whose
 * entry registers the kind; otherwise the paint-kind registry loads it the
 * first time a mesh paint is looked up.
 */

export {
  MESH_GRADIENT_KIND,
  isMeshGradientFill,
  meshFromStops,
  meshGradientXml,
  meshStops,
  seedMeshPatch,
  type MeshGradientFill,
} from './meshPaint';
export {
  evalPatch,
  isTensorPatch,
  isValidPatch,
  patchBounds,
  patchCorner,
  cornerWeights,
  type MeshPatch,
  type MeshPoint,
} from './surface';
export { bakeMesh, meshBounds, MESH_BAKE_SIZE, type BakedMesh, type MeshBox } from './bake';
export { meshBakeSize, MESH_BAKE_MAX, MESH_BAKE_MIN } from './bakeCache';
export {
  meshGuides,
  meshHandles,
  moveMeshHandle,
  type MeshGuides,
  type MeshHandle,
  type MeshHandleKind,
  type MeshPointRef,
} from './handles';
