import { useEffect } from 'react';
import { useLatest } from '@weasel-js/react';
import { runLayoutPass, type ResolvedLayoutFrame } from 'core/scene/layoutPass';
import type { NodeId, Scene, SceneArrivalHandler } from 'core/scene/types';
import { poseDescriptorForNode, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import { IDENTITY_POSE_COMPOSITION, type PoseComposition } from 'features/groups/composePose';
import type { LayoutStrategy } from './types';

/** Where a container's layout comes from: a map by container id, or a
 *  resolver. The same shape `<SceneCanvas layouts>` takes. */
export type LayoutSource<TPose> =
  | Record<string, LayoutStrategy<TPose>>
  | ((containerId: string) => LayoutStrategy<TPose> | null);

/** Options for {@link layoutArrivalHandler} and {@link useLayoutArrivals}. */
export interface LayoutArrivalOptions<TPose> {
  layouts: LayoutSource<TPose>;
  /** How poses are read and resized. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
  /** How a child's stored pose folds into its parent's frame. Default: the
   *  absolute-pose model, where it does not. */
  poseComposition?: PoseComposition<TPose>;
}

/**
 * A scene arrival handler over `layouts`: the scene's own layout pass
 * (`arrive` for children that joined a container, `childPoses` for any other
 * change to its children or size), measured through the canvas's pose
 * descriptor and composition. A container that declares its own layout
 * (`ContainerNode.layout`) is arranged by that one; `layouts` fills in for
 * the rest.
 */
export function layoutArrivalHandler<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  opts: LayoutArrivalOptions<TPose>,
): SceneArrivalHandler<TPose> {
  const { layouts } = opts;
  const getLayout = typeof layouts === 'function'
    ? layouts
    : (id: string) => layouts[id] ?? null;
  const layoutOf = (id: NodeId) => scene.layoutOf(id) ?? getLayout(id as string);
  const d = (opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  const descriptorOf = (id: NodeId) => poseDescriptorForNode(d, scene.get(id));
  const frame: ResolvedLayoutFrame<TPose> = {
    bounds: (pose, id) => descriptorOf(id).getBounds(pose),
    remap: (pose, from, to, id) => descriptorOf(id).remapBounds(pose, from, to),
    composition: (opts.poseComposition ?? IDENTITY_POSE_COMPOSITION) as PoseComposition<TPose>,
  };
  return (arrivals, changed) => runLayoutPass(scene, layoutOf, arrivals, changed, frame);
}

/**
 * Install {@link layoutArrivalHandler} on `scene` for as long as the calling
 * component is mounted. `<SceneCanvas layouts>` does this itself; call it
 * when a canvas is wired by hand through `sceneToAdapter({ layouts })`.
 */
export function useLayoutArrivals<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  opts: Partial<LayoutArrivalOptions<TPose>>,
): void {
  const latest = useLatest(opts);
  const wired = opts.layouts !== undefined;
  useEffect(() => {
    if (!wired) return;
    return scene.setArrivalHandler((arrivals, changed) => {
      const { layouts, poseDescriptor, poseComposition } = latest.current;
      if (!layouts) return new Map();
      return layoutArrivalHandler(scene, { layouts, poseDescriptor, poseComposition })(arrivals, changed);
    });
  }, [scene, wired, latest]);
}
