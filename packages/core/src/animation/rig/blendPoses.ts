import { IDENTITY_JOINT, type JointTransform, type Pose } from './types';

const TAU = Math.PI * 2;

/** Shortest signed angular delta from `a` to `b`, in (-PI, PI]. */
function shortestDelta(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

const FIELDS: (keyof JointTransform)[] = ['x', 'y', 'scaleX', 'scaleY'];

/**
 * Weighted blend of poses. Weights are normalized, so `[1, 1]` means an even
 * mix. A joint absent from a pose contributes its identity delta, and a field
 * absent from a joint contributes that field's identity — 0 for translation and
 * rotation, 1 for scale. Blending scale toward 0 for an absent field would
 * collapse the joint, which is the bug this avoids.
 *
 * Rotation blends the short way around the circle, so 0.1 and TAU-0.1 average
 * to 0 rather than to PI.
 *
 * This doubles as the interpolator for a `SampledTrack<Pose>`: interpolating
 * between two poses at `u` is `blendPoses([a, b], [1 - u, u])`.
 */
export function blendPoses(poses: Pose[], weights: number[]): Pose {
  if (poses.length !== weights.length) {
    throw new Error('blendPoses: poses and weights must have the same length');
  }
  const total = weights.reduce((s, w) => s + w, 0);
  if (total === 0) return {};
  const norm = weights.map((w) => w / total);

  const names = new Set<string>();
  for (const p of poses) for (const k of Object.keys(p)) names.add(k);

  const out: Pose = {};
  for (const name of names) {
    const joint: Partial<JointTransform> = {};

    for (const field of FIELDS) {
      let acc = 0;
      for (let i = 0; i < poses.length; i += 1) {
        const v = poses[i][name]?.[field];
        acc += (v ?? IDENTITY_JOINT[field]) * norm[i];
      }
      joint[field] = acc;
    }

    // Rotation accumulates as a delta from the first pose's value so wrapping
    // is handled once, against a fixed reference.
    const base = poses[0][name]?.rotation ?? 0;
    let rot = 0;
    for (let i = 0; i < poses.length; i += 1) {
      const v = poses[i][name]?.rotation ?? 0;
      rot += shortestDelta(base, v) * norm[i];
    }
    joint.rotation = base + rot;

    out[name] = joint;
  }
  return out;
}
