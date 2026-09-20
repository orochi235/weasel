// `@weasel-js/core/math` — the geometry and simulation primitives, with no
// React anywhere in the import graph.
//
// The barrel reaches the canvas and the hooks, so importing `@weasel-js/core`
// from a Node process pulls React in whether or not a single component is
// used. Everything here is a function over numbers: a server rendering a
// layout — `@weasel-js/diagram/layout` is the first one — needs exactly this
// half and must not need the other.
//
// Named rather than `export *`: esbuild cannot enumerate a star re-export
// across a package boundary and emits no binding for it. These re-export from
// leaf modules rather than from `features/paths`, whose own barrel reaches the
// pen preview and the path-editing overlay layers.
//
// One leaf reaching this package's own barrel is enough to undo all of it:
// `pointAlongPath` alone pulled nine chunks and a megabyte of canvas here
// until `tessellate/polyline` stopped doing that (a6eb682b). `npm run
// check:react-free` is what notices, and it reads the built closure — no
// arrangement of these lines can be trusted on its own.

export type {
  Path,
  PathFillRule,
  PolygonPath,
  RectPath,
} from 'core/geometry/path';
export {
  PATH_C,
  PATH_CMD_LENGTHS,
  PATH_L,
  PATH_M,
  PATH_Q,
  PATH_Z,
  pathCommandCoordCount,
} from 'core/geometry/path';
export type { Vec2 } from 'core/geometry/polygonHitTestRect';
export type { PoseDescriptor } from 'core/geometry/poseDescriptor';
export { translatePoseViaDescriptor } from 'core/geometry/poseDescriptor';
export {
  PathBuilder,
  polygonFromPoints,
  polylineFromPoints,
  rectPath,
} from 'features/paths/builder';
export {
  DEFAULT_FLATTEN_TOLERANCE,
  flattenCubic,
  flattenCubicWithArcLen,
  flattenQuadratic,
  flattenQuadraticWithArcLen,
} from 'features/paths/flatten';
export { pointAlongPath } from 'features/paths/pathAt';
export { createSimulation } from 'features/simulation/createSimulation';
export type {
  Simulation,
  SimulationCore,
  SimulationForce,
  SimulationNode,
  SimulationOptions,
} from 'features/simulation/types';
export { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
export { rotatePoint } from 'interactions/actions/rotate/geometry';
