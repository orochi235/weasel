import type { ClipBinder, Pose, Target } from '@weasel-js/animator';
import type { PoseDescriptor } from '../core/geometry/poseDescriptor';
import { scenePoseTarget, type PoseTargetScene } from './poseTarget';

/** Options for `sceneClipTargets`. */
export interface SceneClipTargetsOptions<TPose> {
  /** Rigs by the name a clip calls them: a track naming `rig:<name>` moves that rig's pose. */
  rigs?: Readonly<Record<string, { readonly target: Target<Pose> }>>;
  /** As `scenePoseTarget` takes them. */
  descriptor?: PoseDescriptor<TPose>;
}

/**
 * A `ClipBinder.target` over a scene. `pose:<node id>` is that node's pose target, the one
 * `scenePoseTarget` answers, and `rig:<name>` is the target of the rig given under that
 * name. Any other name is `undefined`, for a caller to resolve itself first or after. A track
 * over part of a rig names joints as its `axes`, which the rig's target resolves.
 */
export function sceneClipTargets<TPose>(
  scene: PoseTargetScene<TPose>,
  options: SceneClipTargetsOptions<TPose> = {},
): NonNullable<ClipBinder['target']> {
  return (name) => {
    if (name.startsWith('pose:')) return scenePoseTarget(scene, name.slice(5), options.descriptor);
    if (name.startsWith('rig:')) return options.rigs?.[name.slice(4)]?.target;
    return undefined;
  };
}
