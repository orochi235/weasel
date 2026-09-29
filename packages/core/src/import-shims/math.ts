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
// across a package boundary and emits no binding for it. The path math comes
// from `@weasel-js/geom`; the rest re-exports from leaf modules rather than
// from core's own barrels, which reach the canvas.
//
// One leaf reaching this package's own barrel is enough to undo all of it.
// `npm run check:react-free` is what notices, and it reads the built closure —
// no arrangement of these lines can be trusted on its own.

export {
  DEFAULT_FLATTEN_TOLERANCE,
  PATH_C,
  PATH_CMD_LENGTHS,
  PATH_L,
  PATH_M,
  PATH_Q,
  PATH_Z,
  PathBuilder,
  flattenCubic,
  flattenCubicWithArcLen,
  flattenQuadratic,
  flattenQuadraticWithArcLen,
  pathCommandCoordCount,
  pointAlongPath,
  polygonFromPoints,
  polylineFromPoints,
  rectPath,
  type Path,
  type PathFillRule,
  type PolygonPath,
  type RectPath,
} from '@weasel-js/geom';
export type { Vec2 } from 'core/geometry/vec2';
export type { PoseDescriptor } from 'core/geometry/poseDescriptor';
export { translatePoseViaDescriptor } from 'core/geometry/poseDescriptor';
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
