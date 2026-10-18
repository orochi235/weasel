// ─── Snap sources and sessions ───
export type {
  SnapBegin, SnapConstrain, SnapMods, SnapOutcome, SnapResizeBox, SnapSession,
} from '../interactions/actions/snapDep';
export type {
  AngleCandidate, AngleCollect, Locus, SceneCanvasSnap, SnapCollect, SnapEdge, SnapEdges, SnapGesture, SnapMark,
  SnapMarks, SnapProbeAt, SnapSource, SourceCandidate,
} from '../features/snap/types';
export { SNAP_ROLES, snapMods } from '../features/snap/roles';
export { createSnapOutcomeStore, type SnapOutcomeStore } from '../features/snap/outcomeStore';
export { useSnapSource } from '../features/snap/registry';
export { rotationSnapSource } from '../features/snap/rotationSource';
export { pathSnapSource, type PathSnapSourceOptions } from '../features/paths/pathSnap/pathSnapSource';
export { DEFAULT_SNAP_PX } from '../features/snap/session2d';
export { createSnapReadoutLayer, type SnapReadoutStyle } from '../features/snap/readoutLayer';
export { measuredSegmentCommands, pillCommands, tickedSegment } from '../features/snap/readoutDraw';
export type { SnapReadoutDep } from '../features/snap/readoutDep';
