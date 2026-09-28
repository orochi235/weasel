/**
 * The mesh-gradient paint kind. Importing any of it registers the kind and its
 * shader program; otherwise the paint-kind registry loads it the first time a
 * mesh paint is looked up.
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
