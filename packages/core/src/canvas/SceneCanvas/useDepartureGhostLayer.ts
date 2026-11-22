/**
 * The layer `<SceneCanvas poseTransition exit>` draws removed nodes leaving
 * on: each ghost through the scene slot's `drawOne`, at the pose and opacity
 * its glide shows, inside the frame of a parent still in the scene.
 */
import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { composeChildFrame, composesFrames, type PoseAdapter } from 'core/scene/composePose';
import { viewPoseAdapter } from 'core/scene/scrollOffsets';
import { definesFrame, effectivePose } from 'core/scene/effectivePose';
import { hidesSubtree } from 'core/scene/nodeGates';
import type { RemovedNode } from 'core/scene/poseWrites';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { deriveParallaxView, type PlaneMap } from 'core/viewport/parallax';
import type { View } from 'core/viewport/view';
import type { Departures } from '../../animation/departures';
import { isCustomEntry, type LayersMap } from '../layerSlots';
import { wrapWithPoseRotation } from '../poseRotation';
import { createLayerPlaneLookup } from '../pickWalk';
import { planeTransform } from '../planeClips';
import { pixelScaleCtx } from '../pixelScale';
import { ownClipOf } from '../ownClip';
import { nodeShapesOf } from '../nodeShapeRegistry';

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
    draw: (_data, view, dims) => {
      const slot = slotRef.current;
      const leaving = departures.shown();
      if (leaving.length === 0 || !slot || isCustomEntry(slot) || !slot.drawOne) return [];
      const drawOne = slot.drawOne;
      const sc = sceneRef.current;
      const { compose } = sc.composition;
      const composes = composesFrames(sc.composition);
      const frames = viewPoseAdapter(sc, {
        getParent: (id: string) => sc.get(id as NodeId)?.parent ?? null,
        getPose: (id: string) => effectivePose(sc, sc.get(id as NodeId)!),
        definesFrame: (id: string) => definesFrame(sc.get(id as NodeId)!),
      } as PoseAdapter<TPose>);
      // As the scene paints it: a hidden node and its subtree are not drawn, nor a
      // node on a hidden layer; a node is drawn at the slot's drawn pose; one
      // on a parallax layer is drawn through its plane's view and carried
      // into its parent's world.
      const planeOf = createLayerPlaneLookup(sc.layers, view);
      const shown = new Set(sc.layers.filter((l) => l.visible).map((l) => l.id as string));
      const viewOf = (layer: string): View => {
        const parallax = planeOf ? sc.layers.find((l) => l.id === layer)?.parallax : undefined;
        return parallax ? deriveParallaxView(view, parallax) : view;
      };
      const draw = (
        r: RemovedNode<TPose, Node<TData, TLayer, TPose>>, pose: TPose, parentPlane: PlaneMap | null, out: DrawCommand[],
      ): void => {
        if (hidesSubtree(r.node)) return;
        const layer = r.node.layer;
        const plane = planeOf?.(layer) ?? null;
        const v = viewOf(layer);
        const drawn = shown.has(layer) && slot.drawnPose ? slot.drawnPose(r.node, pose) : pose;
        const scaled = pixelScaleCtx(v, dims.dpr);
        const children: DrawCommand[] = shown.has(layer)
          ? wrapWithPoseRotation(drawOne(r.node, drawn, v, scaled), drawn) : [];
        const kids: DrawCommand[] = [];
        for (const c of r.children) draw(c, composes ? compose(pose, c.pose) : c.pose, plane, kids);
        // The node's clip is its children's, not its own paint's.
        const clip = kids.length > 0
          ? ownClipOf(r.node, pose, () => slot.derivedPathOf?.(r.node, pose), nodeShapesOf(sc), scaled.scale) : null;
        children.push(...(clip ? [{ kind: 'group', clip, children: kids } as GroupDrawCommand] : kids));
        const transform = planeTransform(plane, parentPlane);
        out.push(transform ? { kind: 'group', transform, children } : { kind: 'group', children });
      };
      return leaving.map(({ removal, pose, alpha }): DrawCommand => {
        const parent = removal.parent !== null && sc.get(removal.parent) ? removal.parent : null;
        const world = composes && parent !== null ? compose(composeChildFrame(frames, parent, compose), pose) : pose;
        const children: DrawCommand[] = [];
        draw(removal, world, null, children);
        return { kind: 'group', alpha: Math.max(0, Math.min(1, alpha)), children };
      });
    },
  }), [departures, sceneRef, slotRef]);
}
