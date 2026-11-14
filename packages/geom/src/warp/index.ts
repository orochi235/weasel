/**
 * `@weasel-js/geom/warp` — warping paths: plane warps, cloth warps, and pin warps, as
 * maps and as data a shape can hold. A pin warp triangulates the shape's fill,
 * which needs `earcut`, an optional peer of geom.
 *
 * @packageDocumentation
 */
export { bilinearQuad, projectiveQuad, squareToQuadHomography, type Quad, type UvMap } from './quad';
export { bicubicMesh, coonsMesh, meshGridFrom, meshGridOver, type MeshGrid } from './mesh';
export { pinWarpMap, pinWarpSolve, unwarpPoint, type WarpPin } from './pinWarp';
export { pinWarpMesh, type PinWarpMesh, type PinWarpMeshOptions } from './pinWarpMesh';
export {
  ARAP_INJECTIVE_ROUNDS,
  ARAP_ROUNDS,
  createArapSolver,
  type ArapMesh,
  type ArapSolveOptions,
  type ArapSolver,
  type ArapStage,
  type ArapStep,
} from './arap';
export { warpPath, type WarpPathOptions } from './warpPath';
export {
  applyPathWarp,
  planeOver,
  clothOver,
  moveWarpControl,
  pathWarpMap,
  resizeCloth,
  warpControls,
  type PlaneMode,
  type PlaneWarp,
  type ClothMapping,
  type ClothWarp,
  type PathWarp,
  type PinWarp,
  type WarpBox,
} from './pathWarp';
