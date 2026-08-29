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
import { asNodeId } from 'core/scene/types';
import { findShapeSilhouette } from '../NodeShape';
import { wrapWithPoseRotation } from '../poseRotation';
import type { Dispatcher } from 'interactions/dispatcher/dispatcher';
import { previewSourcesFrom, previewPoseIn, previewDataIn } from '../drawEnvelope';

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
      const idSet = new Set<string>();
      for (const source of sources) {
        const ids = source.previewIds?.();
        if (!ids) continue;
        for (const id of ids) idSet.add(id);
      }
      if (idSet.size === 0) return [];
      const sc = sceneRef.current;

      const previewPoseFor = (id: string): TPose | null =>
        previewPoseIn(sources, id) as TPose | null;
      const previewDataFor = (id: string): TData | null =>
        previewDataIn(sources, id) as TData | null;

      // Build the preview subtree rooted at `id` — mirrors buildSceneTree's
      // structure (container groups carry a clip from their painter's
      // silhouette) but uses preview poses (and data) instead of committed
      // ones, so children are clipped to the previewed container shape
      // during drag.
      const buildSubtree = (id: string): DrawCommand[] => {
        const node = sc.get(asNodeId(id));
        if (!node) return [];
        const pose = previewPoseFor(id);
        const data = previewDataFor(id);
        // Skip when no source emitted ANYTHING for this id — preview-data-
        // only edits still light up here, but pure pose-less, data-less
        // entries don't waste a draw pass.
        if (pose == null && data == null) return [];
        const effPose = pose ?? node.pose;
        // Synthesize a node with the preview data so drawOne sees the
        // in-flight values for any data fields the painter reads
        // (path, fill, text, etc.).
        const effNode = data == null ? node : ({ ...node, data } as typeof node);
        const self = drawOne(effNode, effPose, view);
        const selfRotated = wrapWithPoseRotation(self, effPose as unknown);
        const childCommands: DrawCommand[] = [...selfRotated];
        for (const cid of sc.childrenOf(asNodeId(id))) {
          if (!idSet.has(cid)) continue;
          for (const cmd of buildSubtree(cid)) childCommands.push(cmd);
        }
        const group: GroupDrawCommand = { kind: 'group', children: childCommands };
        if (effNode.kind === 'container') {
          const clip = findShapeSilhouette(
            effNode as unknown as Node<unknown, string, TPose>,
            effPose,
          );
          if (clip) group.clip = clip;
        }
        return [group];
      };

      const opaqueSet = new Set<string>();
      for (const source of sources) {
        const ids = source.previewOpaqueIds?.();
        if (!ids) continue;
        for (const id of ids) opaqueSet.add(id);
      }

      // Roots: previewing nodes whose parent isn't previewing — buildSubtree
      // recurses down from each.
      const children: DrawCommand[] = [];
      const opaque: DrawCommand[] = [];
      for (const id of idSet) {
        const node = sc.get(asNodeId(id));
        const parent = node?.parent;
        if (parent != null && idSet.has(parent)) continue;
        const sink = opaqueSet.has(id) ? opaque : children;
        for (const cmd of buildSubtree(id)) sink.push(cmd);
      }
      if (children.length === 0 && opaque.length === 0) return [];
      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      const out: DrawCommand[] = [];
      if (opaque.length > 0) out.push({ kind: 'group', children: opaque });
      if (children.length > 0) out.push({ kind: 'group', alpha: GHOST_ALPHA, children });
      return out;
    },
  }), []);
}
