// ─── Snap sources and sessions ───
export type {
  SnapBegin, SnapConstrain, SnapMods, SnapOutcome, SnapSession,
} from '../interactions/actions/snapDep';
export type {
  AngleCandidate, AngleCollect, Locus, SceneCanvasSnap, SnapCollect, SnapGesture, SnapMark, SnapMarks, SnapProbeAt,
  SnapSource, SourceCandidate,
} from '../features/snap/types';
export { SNAP_ROLES, snapMods } from '../features/snap/roles';
export { createSnapOutcomeStore, type SnapOutcomeStore } from '../features/snap/outcomeStore';
export { useSnapSource } from '../features/snap/registry';
export { createSession2d, DEFAULT_SNAP_PX, type Session2dInputs } from '../features/snap/session2d';
export { createSnapReadoutLayer, type SnapReadoutStyle } from '../features/snap/readoutLayer';
export { measuredSegmentCommands, pillCommands, tickedSegment } from '../features/snap/readoutDraw';
export type { SnapReadoutDep } from '../features/snap/readoutDep';
