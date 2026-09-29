import { useEffect } from 'react';
import { useLatest } from '@weasel-js/react';
import { documentPose, definesFrame } from 'core/scene/effectivePose';
import type { NodeId, Scene, SceneArrivalHandler } from 'core/scene/types';
import { poseDescriptorForNode, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import {
  composeWorldPose,
  rebaseLocalPose,
  IDENTITY_POSE_COMPOSITION,
  type PoseAdapter,
  type PoseComposition,
} from 'features/groups/composePose';
import type { LayoutChild, LayoutStrategy } from './types';

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
 * A scene arrival handler that hands each container's arrivals to its layout
 * strategy's `arrive`, and refuses the edit when any strategy does.
 * Containers with no layout, or whose layout has no `arrive`, take their
 * arrivals as they come.
 */
export function layoutArrivalHandler<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  opts: LayoutArrivalOptions<TPose>,
): SceneArrivalHandler<TPose> {
  const { layouts } = opts;
  const getLayout = typeof layouts === 'function'
    ? layouts
    : (id: string) => layouts[id] ?? null;
  const d = (opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  const pc = (opts.poseComposition ?? IDENTITY_POSE_COMPOSITION) as PoseComposition<TPose>;

  return (arrivals) => {
    // Poses already decided in this settle, so a container resized here is
    // the frame its children are rebased into.
    const out = new Map<NodeId, TPose>();
    const pa: PoseAdapter<TPose> = {
      getPose: (id) => out.get(id as NodeId) ?? documentPose(scene, scene.get(id as NodeId)!),
      getParent: (id) => scene.get(id as NodeId)?.parent ?? null,
      definesFrame: (id) => {
        const node = scene.get(id as NodeId);
        return node === undefined || definesFrame(node);
      },
    };
    const world = (id: string): TPose => composeWorldPose(pa, id, pc.compose);
    const boundsOf = (id: string, pose: TPose) => poseDescriptorForNode(d, scene.get(id as NodeId)).getBounds(pose);

    for (const [containerId, ids] of arrivals) {
      const layout = getLayout(containerId);
      if (!layout?.arrive) continue;
      const containerWorld = world(containerId);
      const container = { id: containerId as string, bounds: boundsOf(containerId, containerWorld) };
      const children: LayoutChild<TPose>[] = scene.childrenOf(containerId).map((cid) => ({
        id: cid as string,
        pose: world(cid),
      }));
      const result = layout.arrive(container, children, new Set<string>(ids));
      if (result === null) return null;
      if (result.bounds) {
        const node = scene.get(containerId)!;
        const grown = poseDescriptorForNode(d, node).remapBounds(containerWorld, container.bounds, result.bounds);
        out.set(containerId, rebaseLocalPose(pa, grown, node.parent, pc.compose, pc.decompose));
      }
      for (const [cid, pose] of result.poses) {
        out.set(cid as NodeId, rebaseLocalPose(pa, pose, containerId, pc.compose, pc.decompose));
      }
    }
    return out;
  };
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
    return scene.setArrivalHandler((arrivals) => {
      const { layouts, poseDescriptor, poseComposition } = latest.current;
      if (!layouts) return new Map();
      return layoutArrivalHandler(scene, { layouts, poseDescriptor, poseComposition })(arrivals);
    });
  }, [scene, wired, latest]);
}
