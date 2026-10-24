/**
 * Preview-ghost render layer for `<SceneCanvas>`. Renders in-flight gesture
 * poses on top of the committed scene by reusing the scene slot's `drawOne`.
 * Which ids are displaced (`previewIds`) and where (`previewPose`) comes from
 * the drawing view's preview sources on the draw envelope: that view's
 * in-flight handles.
 *
 * This replaces the per-tool `drawGhost` fold-in — a single SceneCanvas
 * concern instead of every consumer wiring it.
 */
import { useEffect, useMemo, useReducer } from 'react';
import { useLatest } from '@weasel-js/react';
import { type DrawCommand, type GroupDrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { isCustomEntry, type LayersMap } from '../layerSlots';
import type { Node, Scene } from 'core/scene/types';
import { ownClipOf } from '../ownClip';
import { wrapWithPoseRotation } from '../poseRotation';
import type { Dispatcher } from '@weasel-js/routing';
import { previewSourcesFrom } from '../drawEnvelope';
import { resolvePreviews, type PreviewNode } from 'interactions/actions/resolvePreviews';
import { scenePlaneOf } from '../pickWalk';
import { planeTransform } from '../planeClips';
import { deriveParallaxView } from 'core/viewport/parallax';
import type { PlaneMap } from 'core/viewport/parallax';
import { mat3 } from '@weasel-js/geom';
import { copiesAbove } from '../copiesAbove';
import { scenePaintedPoseOf } from '../derivedPath';
import { inheritedPaintOf, inheritsPaint, sceneAncestors } from 'core/scene/inheritedPaint';

const GHOST_ALPHA = 0.85;

export function usePreviewGhostLayer<TData, TLayer extends string, TPose>(args: {
  scene: Scene<TData, TLayer, TPose>;
  sceneSlot: LayersMap<Node<TData, TLayer, TPose>, TPose>['scene'];
  /**
   * The surface's dispatcher, subscribed to only so a pump repaints — preview
   * poses mutate silently inside handles otherwise. What gets *painted* is the
   * drawing view's own `getPreviewSources()`, off the draw envelope.
   */
  dispatcher?: Dispatcher | null;
}): RenderLayer<unknown> {
  const { scene, sceneSlot, dispatcher } = args;

  // Refs let the layer body read the last committed scene/slot without
  // re-creating the layer on every host render.
  const sceneRef = useLatest(scene);
  const sceneSlotRef = useLatest(sceneSlot);

  // Subscribe to dispatcher state changes so the canvas re-renders on every
  // ongoing-action pump (preview poses mutate silently inside handles
  // otherwise — single-frame ghost stuck on the start pose).
  const [, forceRerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!dispatcher) return;
    const unsub = dispatcher.subscribe(forceRerender);
    return unsub;
  }, [dispatcher]);

  return useMemo<RenderLayer<unknown>>(() => ({
    id: 'preview-ghost',
    label: 'Preview ghost',
    draw: (data, view) => {
      const slot = sceneSlotRef.current;
      if (!slot || isCustomEntry(slot) || !slot.drawOne) return [];
      const drawOne = slot.drawOne;
      // Whose gesture this frame is showing belongs to the view being drawn,
      // not to the surface that built the layer.
      const sources = previewSourcesFrom(data);
      const sc = sceneRef.current;
      const roots = resolvePreviews(sources, sc);
      if (roots.length === 0) return [];

      // A node on a parallax layer ghosts where its plane draws it: through
      // the plane's view, inside a group carrying it into its parent's world.
      const planeOf = scenePlaneOf(sc.layers, view);
      const mapOf = (layer: string): PlaneMap | null => planeOf?.(layer) ?? null;
      const viewOf = (layer: string) => {
        const parallax = planeOf ? sc.layers.find((l) => l.id === layer)?.parallax : undefined;
        return parallax ? deriveParallaxView(view, parallax) : view;
      };

      // Mirrors buildSceneTree's structure, but drawn from the previewed pose
      // and data, so children are clipped to the shape the node is taking and
      // inherit the paint it is taking. `above` is its containers, innermost first.
      const drawEntry = (
        entry: PreviewNode<TData, TLayer, TPose>,
        parentPlane: PlaneMap | null,
        above: () => Iterable<{ kind?: string; data?: unknown }>,
      ): DrawCommand[] => {
        const effNode = entry.data === entry.node.data
          ? entry.node
          : ({ ...entry.node, data: entry.data } as typeof entry.node);
        const plane = mapOf(entry.node.layer);
        const ctx = inheritsPaint(effNode) ? { inherited: inheritedPaintOf(effNode, above()) } : undefined;
        const self = drawOne(effNode, entry.pose, viewOf(entry.node.layer), ctx);
        const kids: DrawCommand[] = [];
        for (const child of entry.children) {
          for (const cmd of drawEntry(child, plane, () => [effNode, ...above()])) kids.push(cmd);
        }
        // The node's clip is its children's, not its own paint's.
        const clip = kids.length > 0
          ? ownClipOf(effNode, entry.pose, () => slot.derivedPathOf?.(effNode, entry.pose)) : null;
        const children: DrawCommand[] = [
          ...wrapWithPoseRotation(self, entry.pose as unknown),
          ...(clip ? [{ kind: 'group', clip, children: kids } as GroupDrawCommand] : kids),
        ];
        const transform = planeTransform(plane, parentPlane);
        return [transform ? { kind: 'group', transform, children } : { kind: 'group', children }];
      };

      // Opaque is honored at subtree-root granularity, as it always was: a
      // sibling reflowing into place brings its own contents with it.
      const ghosted: DrawCommand[] = [];
      const settled: DrawCommand[] = [];
      // A node an ancestor draws copies of is ghosted in each copy too, or
      // the copies vanish for the length of the gesture.
      const paintedPose = scenePaintedPoseOf(sc);
      for (const root of roots) {
        const sink = root.opaque ? settled : ghosted;
        const cmds = drawEntry(root, null, () => sceneAncestors((id: never) => sc.get(id), root.node));
        for (const cmd of cmds) sink.push(cmd);
        for (const m of copiesAbove(sc, root.node.id, paintedPose)) {
          sink.push({ kind: 'group', transform: mat3.fromAffine(m), children: cmds });
        }
      }
      if (ghosted.length === 0 && settled.length === 0) return [];
      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      const out: DrawCommand[] = [];
      if (settled.length > 0) out.push({ kind: 'group', children: settled });
      if (ghosted.length > 0) out.push({ kind: 'group', alpha: GHOST_ALPHA, children: ghosted });
      return out;
    },
  }), [sceneRef, sceneSlotRef]);
}
