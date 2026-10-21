import type {
  CanvasDebugSink,
  DebugConfig,
  DebugSnapshot,
  HandleKind,
  HitShape,
} from './types';

/**
 * Build a sink that stores recorded primitives in arrays keyed by feature.
 * A `recordX` call no-ops when its flag in `config` is off, so callers can
 * record unconditionally.
 *
 * `beginFrame()` clears every per-frame array. Snap, the latest viewport
 * record, and the last frame's stats survive across frames. `snapshot()`
 * returns live references — no copy.
 */
export function createDebugSink(config: DebugConfig): CanvasDebugSink {
  const snap: DebugSnapshot = {
    hitboxes: [],
    handles: [],
    bounds: [],
    origins: [],
    snap: [],
    layers: [],
    viewport: null,
    frame: null,
  };
  const highlighted = new Set(config.highlight ?? []);
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
      if (!config.bounds && !highlighted.has(id)) return;
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
    recordViewport(kind, from, to, anchor) {
      if (!config.viewport) return;
      snap.viewport = anchor ? { kind, from, to, anchor } : { kind, from, to };
    },
    recordFrame(stats) {
      if (!config.fps) return;
      snap.frame = stats;
    },
    beginFrame() {
      snap.hitboxes.length = 0;
      snap.handles.length = 0;
      snap.bounds.length = 0;
      snap.origins.length = 0;
      snap.layers.length = 0;
    },
    clearSnap() {
      snap.snap.length = 0;
    },
    snapshot() {
      return snap;
    },
  };
}
