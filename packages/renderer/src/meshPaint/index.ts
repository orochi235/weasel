/**
 * The mesh-gradient paint kind's geometry, baking, and draw slots, published
 * as `@weasel-js/renderer/mesh`. `@weasel-js/core/mesh` registers the kind.
 */

export {
  MESH_GRADIENT_KIND,
  isMeshGradientPaint,
  meshFromStops,
  meshGradientXml,
  meshStops,
  seedMeshPatch,
  type MeshGradientPaint,
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
