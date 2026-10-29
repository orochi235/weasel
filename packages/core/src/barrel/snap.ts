// ─── Snap sources and sessions ───
export type {
  SnapBegin, SnapConstrain, SnapMods, SnapOutcome, SnapResizeBox, SnapSession,
} from '../interactions/actions/snapDep';
export type {
  AngleCandidate, AngleCollect, Locus, SceneCanvasSnap, SnapCollect, SnapFrame, SnapGesture, SnapMark,
  SnapMarks, SnapProbeAt, SnapReadoutStyle, SnapSide, SnapSource, SourceCandidate,
} from '../domains/snap/types';
export { SNAP_ANGLE_STEP, SNAP_AXIS_STEP, SNAP_ROLES, snapMods } from '../domains/snap/roles';
export { createSnapOutcomeStore, type SnapOutcomeStore } from '../domains/snap/outcomeStore';
export {
  assertSnapSourceIds, gatherSnapCandidates, resolvedSnapMarks, snapSourcesFor, type GatherSnapOptions, type SnapCandidateMark,
} from '../domains/snap/gather';
export { pointSnap, type PointSnap } from '../domains/snap/pointSnap';
export { stepAngles } from '../domains/snap/stepAngles';
export { useSnapSource } from '../domains/snap/registry';
export { rotationSnapSource } from '../domains/snap/rotationSource';
export { pathSnapSource, type PathSnapSourceOptions } from '../domains/paths/pathSnap/pathSnapSource';
export { DEFAULT_SNAP_PX } from '../domains/snap/session2d';
export { createSnapReadoutLayer } from '../domains/snap/readoutLayer';
export { measuredSegmentCommands, pillCommands, tickedSegment } from '../domains/snap/readoutDraw';
export type { SnapReadoutDep } from '../domains/snap/readoutDep';
