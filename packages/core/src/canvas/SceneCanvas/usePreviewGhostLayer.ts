/**
 * Preview-ghost render layer for `<SceneCanvas>`. Renders in-flight gesture
 * poses on top of the committed scene by reusing the scene slot's `drawOne`.
 * Which ids are displaced (`previewIds`) and where (`previewPose`) comes from
 * the drawing view's preview sources on the draw envelope — tools first, then
 * that view's in-flight handles.
 *
 * This replaces the per-tool `drawGhost` fold-in — a single SceneCanvas
 * concern instead of every consumer wiring it.
 */
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { type DrawCommand, type GroupDrawCommand } from '../../renderer';
import type { RenderLayer } from 'core/layers/render';
import type { LayersMap } from '../Canvas';
import type { Node, Scene } from 'core/scene/types';
import { findShapeSilhouette } from '../NodeShape';
import { wrapWithPoseRotation } from '../poseRotation';
import type { Dispatcher } from 'interactions/dispatcher/dispatcher';
import { previewSourcesFrom } from '../drawEnvelope';
import { resolvePreviews, type PreviewNode } from 'interactions/actions/resolvePreviews';
import { resolveDerivedPath, sceneDepLookup } from '../derivedPath';

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

  // Refs let the layer body read the latest scene/slot without re-creating the
  // layer on every host render.
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const sceneSlotRef = useRef(sceneSlot);
  sceneSlotRef.current = sceneSlot;

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
      const drawOne = slot?.drawOne;
      if (!slot || !drawOne) return [];
      // Whose gesture this frame is showing belongs to the view being drawn,
      // not to the surface that built the layer.
      const sources = previewSourcesFrom(data);
      const sc = sceneRef.current;
      const roots = resolvePreviews(sources, sc);
      if (roots.length === 0) return [];

      // Reads the same overrides an in-flight gesture publishes, so a derived
      // container ghosts with the clip it will actually impose.
      const depOf = sceneDepLookup(sc);

      // Mirrors buildSceneTree's structure — a container group carries a clip
      // from its painter's silhouette — but drawn from the previewed pose and
      // data, so children are clipped to the shape the container is taking.
      const drawEntry = (
        entry: PreviewNode<TData, TLayer, TPose>,
      ): DrawCommand[] => {
        const effNode = entry.data === entry.node.data
          ? entry.node
          : ({ ...entry.node, data: entry.data } as typeof entry.node);
        const self = drawOne(effNode, entry.pose, view);
        const children: DrawCommand[] = [...wrapWithPoseRotation(self, entry.pose as unknown)];
        for (const child of entry.children) {
          for (const cmd of drawEntry(child)) children.push(cmd);
        }
        const group: GroupDrawCommand = { kind: 'group', children };
        if (effNode.kind === 'container') {
          const clip = findShapeSilhouette(
            effNode as unknown as Node<unknown, string, TPose>,
            entry.pose,
            { derivedPath: resolveDerivedPath(effNode, depOf, (nid) => sc.childrenOf(nid)) },
          );
          if (clip) group.clip = clip;
        }
        return [group];
      };

      // Opaque is honored at subtree-root granularity, as it always was: a
      // sibling reflowing into place brings its own contents with it.
      const ghosted: DrawCommand[] = [];
      const settled: DrawCommand[] = [];
      for (const root of roots) {
        const sink = root.opaque ? settled : ghosted;
        for (const cmd of drawEntry(root)) sink.push(cmd);
      }
      if (ghosted.length === 0 && settled.length === 0) return [];
      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      const out: DrawCommand[] = [];
      if (settled.length > 0) out.push({ kind: 'group', children: settled });
      if (ghosted.length > 0) out.push({ kind: 'group', alpha: GHOST_ALPHA, children: ghosted });
      return out;
    },
  }), []);
}
