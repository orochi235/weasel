import { mat3, worldCoords, type Path } from '@weasel-js/geom';
import { resolveSkeleton } from './resolveSkeleton';
import { skinnable, type Skin } from './skin';
import type { Skeleton } from './types';

/** Options for `autoSkin`. */
export interface AutoSkinOptions {
  /** How fast a bone's pull falls off with distance: a weight is `1 / distance ** power`.
   *  Higher keeps the bend closer to the joint. Default 4. */
  power?: number;
  /** The most joints a point follows; the nearest are kept. Default 2. */
  max?: number;
}

interface Bone {
  joint: string;
  /** Flat `x0, y0, x1, y1` per segment, from the joint to each of its children. */
  segments: number[];
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** A joint's bones run to its children. A joint with no child has none, being where its
 *  parent's bone ends, unless it has no parent either. */
function bonesOf(skeleton: Skeleton): Bone[] {
  const world = resolveSkeleton(skeleton, {});
  const at = new Map<string, [number, number]>();
  for (const [name, m] of world) at.set(name, mat3.apply(m, 0, 0));
  const bones = new Map<string, Bone>();
  for (const joint of skeleton.joints) {
    if (joint.parent == null) continue;
    let bone = bones.get(joint.parent);
    if (!bone) {
      bone = { joint: joint.parent, segments: [] };
      bones.set(joint.parent, bone);
    }
    bone.segments.push(...at.get(joint.parent)!, ...at.get(joint.name)!);
  }
  for (const joint of skeleton.joints) {
    if (joint.parent != null || bones.has(joint.name)) continue;
    const [x, y] = at.get(joint.name)!;
    bones.set(joint.name, { joint: joint.name, segments: [x, y, x, y] });
  }
  // Skeleton order, so a tie between bones goes to the one nearer the root.
  return skeleton.joints.flatMap((joint) => bones.get(joint.name) ?? []);
}

/**
 * Weights for `path` from how far each of its points is from each bone of `skeleton` at the
 * bind pose. `path` is in the skeleton's space. A point on a bone follows that bone alone.
 */
export function autoSkin(path: Path, skeleton: Skeleton, options: AutoSkinOptions = {}): Skin {
  const power = options.power ?? 4;
  const max = Math.max(1, options.max ?? 2);
  const bones = bonesOf(skeleton);
  const coords = worldCoords(skinnable(path));
  const count = coords.length >> 1;
  const out = new Map<string, number[]>();
  const distance = new Float64Array(bones.length);
  const order = bones.map((_, b) => b);

  for (let i = 0; i < count; i++) {
    const px = coords[2 * i];
    const py = coords[2 * i + 1];
    for (let b = 0; b < bones.length; b++) {
      const s = bones[b].segments;
      let d = Infinity;
      for (let k = 0; k < s.length; k += 4) d = Math.min(d, distanceToSegment(px, py, s[k], s[k + 1], s[k + 2], s[k + 3]));
      distance[b] = d;
    }
    order.sort((a, b) => distance[a] - distance[b] || a - b);
    const kept = order.slice(0, max);
    const nearest = distance[kept[0]];
    let total = 0;
    const raw = kept.map((b) => {
      const w = nearest === 0 ? (distance[b] === 0 ? 1 : 0) : (nearest / distance[b]) ** power;
      total += w;
      return w;
    });
    kept.forEach((b, k) => {
      if (raw[k] === 0) return;
      let weights = out.get(bones[b].joint);
      if (!weights) {
        weights = new Array<number>(count).fill(0);
        out.set(bones[b].joint, weights);
      }
      weights[i] = raw[k] / total;
    });
  }
  return Object.fromEntries(out);
}
