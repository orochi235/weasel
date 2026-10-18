/**
 * The layer `<SceneCanvas poseTransition exit>` draws removed nodes leaving
 * on: each ghost through the scene slot's `drawOne`, at the pose and opacity
 * its glide shows, inside the frame of a parent still in the scene.
 */
import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { DrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { composesFrames, composeWorldPose } from 'core/scene/composePose';
import { definesFrame, effectivePose } from 'core/scene/effectivePose';
import type { RemovedNode } from 'core/scene/poseWrites';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { deriveParallaxView } from 'core/viewport/parallax';
import type { View } from 'core/viewport/view';
import type { Departures } from '../../animation/departures';
import { isCustomEntry, type LayersMap } from '../layerSlots';
import { wrapWithPoseRotation } from '../poseRotation';

export function useDepartureGhostLayer<TData, TLayer extends string, TPose>(args: {
  scene: Scene<TData, TLayer, TPose>;
  sceneSlot: LayersMap<Node<TData, TLayer, TPose>, TPose>['scene'];
  departures: Departures<TPose, Node<TData, TLayer, TPose>>;
}): RenderLayer<unknown> {
  const sceneRef = useLatest(args.scene);
  const slotRef = useLatest(args.sceneSlot);
  const { departures } = args;

  return useMemo<RenderLayer<unknown>>(() => ({
    id: 'departure-ghost',
    label: 'Departing nodes',
    draw: (_data, view) => {
      const slot = slotRef.current;
      const leaving = departures.shown();
      if (leaving.length === 0 || !slot || isCustomEntry(slot) || !slot.drawOne) return [];
      const drawOne = slot.drawOne;
      const sc = sceneRef.current;
      const { compose } = sc.composition;
      const composes = composesFrames(sc.composition);
      const frames = {
        getParent: (id: string) => sc.get(id as NodeId)?.parent ?? null,
        getPose: (id: string) => effectivePose(sc, sc.get(id as NodeId)!),
        definesFrame: (id: string) => definesFrame(sc.get(id as NodeId)!),
      };
      const viewOf = (layer: string): View => {
        const parallax = sc.layers.find((l) => l.id === layer)?.parallax;
        return parallax ? deriveParallaxView(view, parallax) : view;
      };
      const draw = (r: RemovedNode<TPose, Node<TData, TLayer, TPose>>, pose: TPose, out: DrawCommand[]): void => {
        out.push(...wrapWithPoseRotation(drawOne(r.node, pose, viewOf(r.node.layer)), pose));
        for (const c of r.children) draw(c, composes ? compose(pose, c.pose) : c.pose, out);
      };
      return leaving.map(({ removal, pose, alpha }): DrawCommand => {
        const parent = removal.parent !== null && sc.get(removal.parent) ? removal.parent : null;
        const world = composes && parent !== null ? compose(composeWorldPose(frames, parent, compose), pose) : pose;
        const children: DrawCommand[] = [];
        draw(removal, world, children);
        return { kind: 'group', alpha: Math.max(0, Math.min(1, alpha)), children };
      });
    },
  }), [departures, sceneRef, slotRef]);
}
