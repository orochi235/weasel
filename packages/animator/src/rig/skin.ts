import {
  coordsFrom, mat3, PATH_L, PATH_M, PATH_Z, worldCoords, type GlMat3, type Path, type PolygonPath,
} from '@weasel-js/geom';
import { resolveSkeleton } from './resolveSkeleton';
import type { Skeleton } from './types';

/**
 * How much each point of a path follows each joint: one array per joint name, indexed by
 * point. Point `i` is the `i`-th coordinate pair of a polygon path's `coords`, so anchors and
 * curve handles are weighted alike; a rect's points are its corners, clockwise from the top
 * left. A joint left out, and an index past an array's end, weigh nothing. Weights need not
 * sum to 1: they are normalized per point as they are applied.
 */
export type Skin = Readonly<Record<string, readonly number[]>>;

/**
 * Each joint's motion since the bind pose, in world space: `world * inverse(restWorld)`.
 * `world` is what `resolveSkeleton` or `Rig.world()` answers.
 */
export function motionsFromRest(
  skeleton: Skeleton,
  world: ReadonlyMap<string, GlMat3>,
): Map<string, GlMat3> {
  const rest = resolveSkeleton(skeleton, {});
  const out = new Map<string, GlMat3>();
  for (const [name, r] of rest) {
    const inverse = mat3.invert(r);
    if (!inverse) throw new Error(`motionsFromRest: joint "${name}" is singular at the bind pose.`);
    const w = world.get(name);
    if (w) out.set(name, mat3.multiply(w, inverse));
  }
  return out;
}

const RECT_COMMANDS = new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]);

/** The path whose points a skin indexes: a rect as its four corners. */
export function skinnable(path: Path): PolygonPath {
  if (path.kind === 'polygon') return path;
  const { x, y, width, height } = path;
  return {
    kind: 'polygon',
    commands: RECT_COMMANDS,
    coords: new Float32Array([x, y, x + width, y, x + width, y + height, x, y + height]),
    fillRule: 'nonzero',
  };
}

/**
 * Bend `path` by linear blend skinning: each point goes where its joints' motions since the
 * bind pose would carry it, averaged by weight. `path` is the shape at the bind pose, in the
 * space `motions` are in; it is not modified. A point no joint weighs stays where it is.
 */
export function skinPath(path: Path, skin: Skin, motions: ReadonlyMap<string, GlMat3>): PolygonPath {
  const rest = skinnable(path);
  const from = worldCoords(rest);
  const count = from.length >> 1;
  const sum = new Float64Array(from.length);
  const total = new Float64Array(count);
  for (const joint in skin) {
    const m = motions.get(joint);
    if (!m) throw new Error(`skinPath: the skin weighs joint "${joint}", which has no motion.`);
    const weights = skin[joint];
    const n = Math.min(count, weights.length);
    for (let i = 0; i < n; i++) {
      const w = weights[i];
      if (!(w > 0)) continue;
      const x = from[2 * i];
      const y = from[2 * i + 1];
      sum[2 * i] += w * (m[0] * x + m[3] * y + m[6]);
      sum[2 * i + 1] += w * (m[1] * x + m[4] * y + m[7]);
      total[i] += w;
    }
  }
  const moved = new Float64Array(from.length);
  for (let i = 0; i < count; i++) {
    const t = total[i];
    moved[2 * i] = t > 0 ? sum[2 * i] / t : from[2 * i];
    moved[2 * i + 1] = t > 0 ? sum[2 * i + 1] / t : from[2 * i + 1];
  }
  return { ...rest, coords: coordsFrom(rest.origin, moved) };
}
