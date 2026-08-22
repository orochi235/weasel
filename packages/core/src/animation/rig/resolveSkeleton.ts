import { mat3, type Mat3 } from '../../renderer/math/mat3';
import type { JointTransform, Pose, Skeleton } from './types';

/** bind + delta, field by field. Scale is multiplicative, the rest additive. */
function compose(bind: JointTransform, delta: Partial<JointTransform> | undefined): JointTransform {
  if (!delta) return bind;
  return {
    x: bind.x + (delta.x ?? 0),
    y: bind.y + (delta.y ?? 0),
    rotation: bind.rotation + (delta.rotation ?? 0),
    scaleX: bind.scaleX * (delta.scaleX ?? 1),
    scaleY: bind.scaleY * (delta.scaleY ?? 1),
  };
}

/** TRS as a Mat3: translate * rotate * scale, applied to a column vector. */
function toMat3(t: JointTransform): Mat3 {
  const c = Math.cos(t.rotation);
  const s = Math.sin(t.rotation);
  const m = new Float32Array(9) as Mat3;
  m[0] = c * t.scaleX;  m[1] = s * t.scaleX;  m[2] = 0;
  m[3] = -s * t.scaleY; m[4] = c * t.scaleY;  m[5] = 0;
  m[6] = t.x;           m[7] = t.y;           m[8] = 1;
  return m;
}

/**
 * Resolve every joint's world transform by walking the skeleton once and
 * composing each joint onto its already-resolved parent.
 *
 * `skeleton.joints` must be in topological order — a joint whose parent has not
 * been resolved yet throws rather than silently resolving against identity,
 * because that failure is otherwise invisible until a limb renders in the wrong
 * place.
 */
export function resolveSkeleton(skeleton: Skeleton, pose: Pose): Map<string, Mat3> {
  const out = new Map<string, Mat3>();
  for (const joint of skeleton.joints) {
    const local = toMat3(compose(joint.bind, pose[joint.name]));
    if (joint.parent == null) {
      out.set(joint.name, local);
      continue;
    }
    const parent = out.get(joint.parent);
    if (!parent) {
      throw new Error(
        `resolveSkeleton: joint "${joint.name}" names parent "${joint.parent}", which has not ` +
        'been resolved. Skeleton.joints must be in topological order.',
      );
    }
    out.set(joint.name, mat3.multiply(parent, local));
  }
  return out;
}
