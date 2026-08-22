/** A joint's local transform. Deliberately NOT the scene's generic `TPose`:
 *  `TPose` is consumer-defined and may be a bare AABB with no rotation term,
 *  which a joint chain cannot compose through. */
export interface JointTransform {
  x: number;
  y: number;
  /** Radians. */
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface Joint {
  name: string;
  /** Parent joint name, or null for a root. */
  parent: string | null;
  /** Local transform at rest. */
  bind: JointTransform;
}

/** Joints in topological order: every joint appears after its parent. */
export interface Skeleton {
  joints: Joint[];
}

/** Local deltas from the bind pose, keyed by joint name. Absent joints and
 *  absent fields mean "no change from bind". */
export type Pose = Record<string, Partial<JointTransform>>;

export const IDENTITY_JOINT: JointTransform = {
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
};
