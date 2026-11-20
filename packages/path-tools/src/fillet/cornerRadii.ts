import { cornerFrames, withCorner, type CornerShape, type PolygonPath } from '@weasel-js/geom';

/** A corner to set: its flat anchor index, shape, and the radius asked of it. */
export interface CornerRadius {
  index: number;
  shape: CornerShape;
  radius: number;
}

/**
 * `path` with every corner in `targets` set, each radius clamped to the room
 * it has: an edge shared with a corner left alone gives up that corner's cut,
 * and two targets on one edge split it in proportion to what each can take.
 * So each radius stored is the one drawn.
 */
export function withCornerRadii(path: PolygonPath, targets: readonly CornerRadius[]): PolygonPath {
  const set = (radiusOf: (t: CornerRadius) => number) =>
    targets.reduce((out, t) => withCorner(out, t.index, { shape: t.shape, radius: radiusOf(t) }), path);
  // With every target at zero, a frame's room is what the corners left alone leave it.
  const room = new Map(cornerFrames(set(() => 0)).map((f) => [f.index, f.maxTrim]));
  const capped = set((t) => Math.max(0, Math.min(t.radius, room.get(t.index) ?? 0)));
  const drawn = new Map(cornerFrames(capped).map((f) => [f.index, f.trim]));
  return set((t) => drawn.get(t.index) ?? 0);
}
