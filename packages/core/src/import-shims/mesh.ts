// Registers the kind for any import of this subpath, which is why core's
// package.json lists this entry and `register` under `sideEffects`.
import '@weasel-js/paint-kinds/mesh';

export {
  MESH_BAKE_MAX,
  MESH_BAKE_MIN,
  MESH_BAKE_SIZE,
  MESH_GRADIENT_KIND,
  bakeMesh,
  cornerWeights,
  evalPatch,
  isMeshGradientPaint,
  isTensorPatch,
  isValidPatch,
  meshBakeSize,
  meshBounds,
  meshFromStops,
  meshGradientXml,
  meshGuides,
  meshHandles,
  meshStops,
  moveMeshHandle,
  patchBounds,
  patchCorner,
  seedMeshPatch,
} from '@weasel-js/renderer/mesh';
export type {
  BakedMesh,
  MeshRect,
  MeshGradientPaint,
  MeshGuides,
  MeshHandle,
  MeshHandleKind,
  MeshPatch,
  MeshPoint,
  MeshPointRef,
} from '@weasel-js/renderer/mesh';
