/**
 * The layer `<SceneCanvas poseTransition exit>` draws removed nodes leaving
 * on: each ghost through the scene slot's `drawOne`, at the pose and opacity
 * its glide shows, inside the frame of a parent still in the scene.
 */
import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { composeChildFrame, composesFrames, frameAtOrAbove, type PoseAdapter } from 'core/scene/composePose';
import { scrolledFrames, viewPoseAdapter } from 'core/scene/scrollOffsets';
import { definesFrame, effectivePose } from 'core/scene/effectivePose';
import { hidesSubtree } from 'core/scene/nodeGates';
import { inheritedPaintOf, inheritsPaint, sceneAncestors } from 'core/scene/inheritedPaint';
import type { RemovedNode } from 'core/scene/poseWrites';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { deriveParallaxView, type PlaneMap } from 'core/viewport/parallax';
import type { View } from 'core/viewport/view';
import type { Departures } from '../../animation/departures';
import { isCustomEntry, type LayersMap } from '../layerSlots';
import { sceneLayerPaintedFrom } from '../drawEnvelope';
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
    draw: (data, view, dims) => {
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
      // As the scene paints it: a hidden node and its subtree are not drawn, nor one under a
      // hidden container still in the scene, nor a
      // node on a layer the scene or the drawing view hides; a node is drawn at the slot's drawn pose; one
      // on a parallax layer is drawn through its plane's view and carried
      // into its parent's world.
      const planeOf = createLayerPlaneLookup(sc.layers, view);
      const paints = sceneLayerPaintedFrom(data, sc.layers);
      const viewOf = (layer: string): View => {
        const parallax = planeOf ? sc.layers.find((l) => l.id === layer)?.parallax : undefined;
        return parallax ? deriveParallaxView(view, parallax) : view;
      };
      // As buildSceneTree folds: an envelope's children share its parent's frame, and a frame's children
      // sit in its pose moved by the scroll it had when it went.
      const scrollBy = scrolledFrames(sc) === undefined ? undefined : sc.composition.scroll;
      const childFrameOf = (r: RemovedNode<TPose, Node<TData, TLayer, TPose>>, pose: TPose, parentFrame: TPose | null): TPose | null => {
        if (!composes) return null;
        if (!definesFrame(r.node)) return parentFrame;
        return r.scroll && scrollBy ? scrollBy(pose, r.scroll) : pose;
      };
      const draw = (
        r: RemovedNode<TPose, Node<TData, TLayer, TPose>>, pose: TPose, parentFrame: TPose | null,
        parentPlane: PlaneMap | null, out: DrawCommand[],
        above: () => Iterable<{ kind?: string; data?: unknown }>,
      ): void => {
        if (hidesSubtree(r.node)) return;
        const layer = r.node.layer;
        const plane = planeOf?.(layer) ?? null;
        const v = viewOf(layer);
        const drawn = paints(layer) && slot.drawnPose ? slot.drawnPose(r.node, pose) : pose;
        const scaled = pixelScaleCtx(v, dims.dpr);
        // A removed container is gone from the scene, so what its children inherit is read from the removal.
        const ctx = inheritsPaint(r.node) ? { ...scaled, inherited: inheritedPaintOf(r.node, above()) } : scaled;
        const children: DrawCommand[] = paints(layer)
          ? wrapWithPoseRotation(drawOne(r.node, drawn, v, ctx), drawn) : [];
        const frame = childFrameOf(r, pose, parentFrame);
        const kids: DrawCommand[] = [];
        for (const c of r.children) {
          draw(c, frame !== null ? compose(frame, c.pose) : c.pose, frame, plane, kids, () => [r.node, ...above()]);
        }
        if (kids.length > 0) {
          // The node's clip is its children's, not its own paint's.
          const clip = ownClipOf(r.node, pose, () => slot.derivedPathOf?.(r.node, pose), nodeShapesOf(sc), scaled.scale);
          children.push(...(clip ? [{ kind: 'group', clip, children: kids } as GroupDrawCommand] : kids));
        }
        const transform = planeTransform(plane, parentPlane);
        out.push(transform ? { kind: 'group', transform, children } : { kind: 'group', children });
      };
      const shownUnder = (parent: NodeId | null): boolean => parent === null
        || ![parent, ...sc.ancestorsOf(parent)].some((id) => { const n = sc.get(id); return n !== undefined && hidesSubtree(n); });
      return leaving.flatMap(({ removal, pose, alpha }): DrawCommand[] => {
        const parent = removal.parent !== null && sc.get(removal.parent) ? removal.parent : null;
        if (!shownUnder(parent)) return [];
        const frameId = composes ? frameAtOrAbove(frames, parent) : null;
        const parentFrame = frameId !== null ? composeChildFrame(frames, frameId, compose) : null;
        const world = parentFrame !== null ? compose(parentFrame, pose) : pose;
        const children: DrawCommand[] = [];
        draw(removal, world, parentFrame, null, children, () => sceneAncestors((id: never) => sc.get(id), removal.node));
        return [{ kind: 'group', alpha: Math.max(0, Math.min(1, alpha)), children }];
      });
    },
  }), [departures, sceneRef, slotRef]);
}
