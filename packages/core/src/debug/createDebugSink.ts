import type {
  DebugConfig,
  DebugSink,
  DebugSnapshot,
  HandleKind,
  HitShape,
} from './types';

/**
 * Build a sink that stores recorded primitives in arrays keyed by feature.
 * Each `recordX` method checks the matching flag in `config` first — when
 * the feature is off, the call no-ops, so callers can record unconditionally
 * without an extra check.
 *
 * `beginFrame()` clears every non-snap array. `clearSnap()` clears the snap
 * array. Snap survives across frames within a gesture (cleared on
 * gesture-end by the Canvas).
 *
 * `snapshot()` returns live references — no copy. The overlay layer reads
 * these in the same render frame.
 */
export function createDebugSink(config: DebugConfig): DebugSink & { snapshot(): DebugSnapshot } {
  const snap: DebugSnapshot = {
    hitboxes: [],
    handles: [],
    bounds: [],
    origins: [],
    snap: [],
    layers: [],
  };
  return {
    recordHitbox(id, kind, shape: HitShape) {
      if (!config.hitboxes) return;
      snap.hitboxes.push({ id, kind, shape });
    },
    recordHandle(id, position, kind: HandleKind) {
      if (!config.handles) return;
      snap.handles.push({ id, position, kind });
    },
    recordBounds(id, bounds) {
      if (!config.bounds) return;
      snap.bounds.push({ id, bounds });
    },
    recordOrigin(id, point) {
      if (!config.origins) return;
      snap.origins.push({ id, point });
    },
    recordSnapCandidate(point, accepted) {
      if (!config.snap) return;
      snap.snap.push({ point, accepted });
    },
    recordLayer(id, label, space, index) {
      if (!config.layers) return;
      snap.layers.push({ id, label, space, index });
    },
    beginFrame() {
      snap.hitboxes.length = 0;
      snap.handles.length = 0;
      snap.bounds.length = 0;
      snap.origins.length = 0;
      snap.layers.length = 0;
      // snap.snap is intentionally preserved
    },
    clearSnap() {
      snap.snap.length = 0;
    },
    snapshot() {
      return snap;
    },
  };
}
