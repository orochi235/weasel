import { RIGID_POSE_COMPOSITION, worldPosesOf, type DerivedDep, type PoseComposition, type RectPose } from '@weasel-js/core';
import type { DiagramSpec } from './fromData';

/** Where each of `specs` draws, by id: its pose folded through the containers above it under `composition`, which
 *  must be the one `diagramScene` was given (default, as there, {@link RIGID_POSE_COMPOSITION}). */
export const specWorldPoses = (
  specs: readonly DiagramSpec[],
  composition: PoseComposition<RectPose> = RIGID_POSE_COMPOSITION,
): Map<string, RectPose> => worldPosesOf(specs as never, composition) as Map<string, RectPose>;

/** Each spec by id as an edge router reads one of its ends: the spec, at the pose it draws at. */
export function specDeps(specs: readonly DiagramSpec[], world: ReadonlyMap<string, RectPose>): (id: unknown) => DerivedDep<RectPose> | undefined {
  const byId = new Map(specs.map((s) => [s.id as string, s]));
  return (id) => {
    const s = byId.get(id as string);
    if (s === undefined) return undefined;
    const pose = world.get(s.id as string) ?? (s.pose as RectPose);
    return { node: { ...s, parent: null, pose } as never, pose, path: null };
  };
}
