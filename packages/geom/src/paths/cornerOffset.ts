/**
 * The corners an offset outline would hold as corners: each of the source's,
 * moved to where its offset edges meet and resized so its cut keeps the
 * same center.
 */
import type { Path } from '../path';
import { pointInPath } from '../pathHitTest';
import { PathBuilder } from './builder';
import type { CornerTrace } from './cornerRestore';
import { withCorner } from './cornerSpec';
import { cornerCuts, resolveCorners } from './corners';

/**
 * Where the corners of `path` would sit on its outline grown by `distance`
 * (shrunk by a negative one), for `restoreCorners` to look for. A corner
 * moves with its edges and keeps its center, so its setback changes by
 * `distance / tan(half the corner's angle)`: a round corner at a right angle
 * grows its radius by exactly `distance`, and is then exactly what the offset
 * draws. A shape whose offset is no longer that shape, or a corner between
 * curved edges, draws differently from its trace, so `restoreCorners` leaves
 * it expanded. A corner shrunk to nothing has no trace.
 */
export function offsetCornerTraces(path: Path, distance: number): CornerTrace[] {
  if (path.kind !== 'polygon' || distance === 0) return [];
  const drawn = resolveCorners(path);
  const out: CornerTrace[] = [];
  for (const cut of cornerCuts(path)) {
    const { anchor: v, spec } = cut;
    const inLen = Math.hypot(cut.start.x - v.x, cut.start.y - v.y);
    const outLen = Math.hypot(cut.end.x - v.x, cut.end.y - v.y);
    if (inLen === 0 || outLen === 0) continue;
    const din = { x: (cut.start.x - v.x) / inLen, y: (cut.start.y - v.y) / inLen };
    const dout = { x: (cut.end.x - v.x) / outLen, y: (cut.end.y - v.y) / outLen };
    const bx = din.x + dout.x, by = din.y + dout.y;
    const bl = Math.hypot(bx, by);
    if (bl < 1e-9) continue;
    const b = { x: bx / bl, y: by / bl };
    const half = Math.acos(Math.max(-1, Math.min(1, din.x * b.x + din.y * b.y)));
    // Just inside the wedge, between the anchor and its cut: filled only
    // where the corner turns away from the fill.
    const probe = Math.min(inLen, outLen) * 0.01;
    const sign = pointInPath(drawn, v.x + b.x * probe, v.y + b.y * probe) ? -1 : 1;
    const radius = spec.radius + (sign * distance) / Math.tan(half);
    if (!(radius > 0)) continue;
    const at = { x: v.x - (b.x * sign * distance) / Math.sin(half), y: v.y - (b.y * sign * distance) / Math.sin(half) };
    const reach = radius * 2 + 1;
    const wedge = new PathBuilder()
      .moveTo(at.x + din.x * reach, at.y + din.y * reach)
      .lineTo(at.x, at.y)
      .lineTo(at.x + dout.x * reach, at.y + dout.y * reach)
      .build();
    const [moved] = cornerCuts(withCorner(wedge, 1, { shape: spec.shape, radius }));
    if (moved) out.push({ anchor: at, spec: moved.spec, start: moved.start, end: moved.end, pieces: moved.pieces });
  }
  return out;
}
