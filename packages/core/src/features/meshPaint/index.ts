/**
 * The mesh-gradient paint kind. Importing this module registers the kind and
 * its shader program, which is why core's barrel imports it for effect.
 */

export {
  MESH_GRADIENT_KIND,
  isMeshGradientFill,
  meshGradientXml,
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
export { bakeMesh, meshBounds, MESH_BAKE_SIZE, type BakedMesh } from './bake';
