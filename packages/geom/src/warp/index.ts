/**
 * `@weasel-js/geom/warp` — warping paths: distorts, envelopes and puppets, as
 * maps and as data a shape can hold. A puppet triangulates the shape's fill,
 * which needs `earcut`, an optional peer of geom.
 *
 * @packageDocumentation
 */
export { bilinearQuad, projectiveQuad, squareToQuadHomography, type Quad, type UvMap } from './quad';
export { bicubicMesh, coonsMesh, meshGridFrom, meshGridOver, type MeshGrid } from './mesh';
export { puppetMap, puppetSolve, unwarpPoint, type PuppetPin } from './puppet';
export { puppetMesh, type PuppetMesh, type PuppetMeshOptions } from './puppetMesh';
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
  distortOver,
  envelopeOver,
  moveWarpControl,
  pathWarpMap,
  resizeEnvelope,
  warpControls,
  type DistortMode,
  type DistortWarp,
  type EnvelopeMapping,
  type EnvelopeWarp,
  type PathWarp,
  type PuppetWarp,
  type WarpBox,
} from './pathWarp';
