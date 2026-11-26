import { getOwn } from '@weasel-js/registry';
import type { ClipBinder, SkeletonPose, Target } from '@weasel-js/animator';
import type { PoseDescriptor } from '../core/geometry/poseDescriptor';
import { scenePoseTarget, type PoseTargetScene } from './poseTarget';
import { sceneDataTarget, type DataLens, type DataTargetScene } from './dataTarget';

/** Options for `sceneClipTargets`. */
export interface SceneClipTargetsOptions<TPose> {
  /** Rigs by the name a clip calls them: a track naming `rig:<name>` moves that rig's pose. */
  rigs?: Readonly<Record<string, { readonly target: Target<SkeletonPose> }>>;
  /** As `scenePoseTarget` takes them. */
  descriptor?: PoseDescriptor<TPose>;
  /** Fields of a node's data by the name a clip calls them: a track naming `data:<node id>.<name>`
   *  moves that field of that node, through `sceneDataTarget`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lenses?: Readonly<Record<string, DataLens<any, any>>>;
}

/**
 * A `ClipBinder.target` over a scene. `pose:<node id>` is that node's pose target, the one
 * `scenePoseTarget` answers, `data:<node id>.<field>` the target of the field `lenses` names,
 * and `rig:<name>` is the target of the rig given under that name. Any other name is `undefined`, for a caller to resolve itself first or after. A track
 * over part of a rig names joints as its `axes`, which the rig's target resolves.
 */
export function sceneClipTargets<TPose>(
  scene: PoseTargetScene<TPose> & DataTargetScene<unknown>,
  options: SceneClipTargetsOptions<TPose> = {},
): NonNullable<ClipBinder['target']> {
  return (name) => {
    if (name.startsWith('pose:')) return scenePoseTarget(scene, name.slice(5), options.descriptor);
    if (name.startsWith('rig:')) return options.rigs ? getOwn(options.rigs, name.slice(4))?.target : undefined;
    if (name.startsWith('data:') && options.lenses) {
      // The field is after the last dot, so a node id may hold dots.
      const dot = name.lastIndexOf('.');
      const lens = dot > 5 ? getOwn(options.lenses, name.slice(dot + 1)) : undefined;
      return lens && sceneDataTarget(scene, name.slice(5, dot), lens);
    }
    return undefined;
  };
}
