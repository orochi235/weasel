/**
 * Preview-ghost render layer for `<SceneCanvas>`. Renders in-flight gesture
 * poses on top of the committed scene by reusing the scene slot's `drawOne`.
 * The active tool publishes which ids are displaced
 * (`previewIds`) and their interim poses (`previewPose`); this layer iterates
 * them and delegates to the slot's draw functions.
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
import type { ToolsApi } from 'tools/useTools';
import { findShapeSilhouette } from '../NodeShape';
import type { Dispatcher } from 'interactions/dispatcher/dispatcher';

/** A source of in-flight preview state — either a tool from the tools
 *  registry or an `OngoingHandle` returned from the dispatcher's in-flight
 *  map. Both expose the same optional pair of methods; the preview-ghost
 *  layer merges sources via first-non-null semantics. */
interface PreviewSource {
  previewIds?: () => Iterable<string> | null;
  previewPose?: (id: string) => unknown;
  /** Optional companion to `previewPose` for actions that mutate node
   *  data (e.g. anchor-edit on `data.path` nodes). Falls back to
   *  committed `node.data` when null/absent. */
  previewData?: (id: string) => unknown;
}

export function usePreviewGhostLayer<TData, TLayer extends string, TPose>(args: {
  scene: Scene<TData, TLayer, TPose>;
  tools: ToolsApi;
  sceneSlot: LayersMap<Node<TData, TLayer, TPose>, TPose>['scene'];
  /**
   * Optional dispatcher — when present, the layer additionally walks
   * `dispatcher.getInFlightHandles()` so dispatcher-path ongoing actions
   * can expose their preview state. Tool-side previews take priority
   * (preserves backwards-compat while actions are migrated). Phase 14e.
   */
  dispatcher?: Dispatcher | null;
}): RenderLayer<unknown> {
  const { scene, tools, sceneSlot, dispatcher } = args;

  // Refs let the layer body read the latest scene/tools/slot without
  // re-creating the layer on every host render.
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const toolsRef = useRef(tools);
  toolsRef.current = tools;
  const sceneSlotRef = useRef(sceneSlot);
  sceneSlotRef.current = sceneSlot;
  const dispatcherRef = useRef(dispatcher);
  dispatcherRef.current = dispatcher;

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
    draw: (_data, view) => {
      const slot = sceneSlotRef.current;
      const drawOne = slot?.drawOne;
      if (!slot || !drawOne) return [];
      const t = toolsRef.current;
      // Walk every relevant tool: a drag may run through `select` while
      // the active tool is `clone` (or vice versa), so the active tool
      // alone is the wrong source. Mirror Canvas's `toolsInPriorityOrder`
      // — hotkey → active → registry → ambient — taking the first
      // non-null previewPose per id.
      const seen = new Set<unknown>();
      const sources: PreviewSource[] = [];
      const push = (source: PreviewSource | undefined) => {
        if (!source || seen.has(source)) return;
        seen.add(source);
        sources.push(source);
      };
      // Tool-side sources first — they take priority during the
      // dispatcher-side preview migration (Phase 14e).
      if (t.hotkeyEngaged) push(t.registry[t.hotkeyEngaged]);
      push(t.registry[t.active]);
      for (const tool of Object.values(t.registry)) push(tool);
      for (const tool of t.ambient) push(tool);
      // Dispatcher-side sources — each in-flight `OngoingHandle` may
      // populate `previewIds()` / `previewPose(id)`; treated as additional
      // sources after the tool registry so tool previews win on overlap.
      const disp = dispatcherRef.current;
      if (disp) {
        for (const handle of disp.getInFlightHandles()) push(handle);
      }
      const idSet = new Set<string>();
      for (const source of sources) {
        const ids = source.previewIds?.();
        if (!ids) continue;
        for (const id of ids) idSet.add(id);
      }
      if (idSet.size === 0) return [];
      const sc = sceneRef.current;

      // Look up a preview pose for `id` across all consulted sources, taking
      // the first non-null match. Priority order:
      //   tool: hotkey > active > registry > ambient
      //   then: dispatcher in-flight handles (in insertion order)
      // This preserves tool-side wins during the Phase 14e migration; once
      // an action has been moved off its legacy hook, its handle will be
      // the only source emitting a pose for the gesture's ids.
      const previewPoseFor = (id: string): TPose | null => {
        for (const source of sources) {
          const p = source.previewPose?.(id) as TPose | null | undefined;
          if (p != null) return p;
        }
        return null;
      };
      const previewDataFor = (id: string): TData | null => {
        for (const source of sources) {
          const d = source.previewData?.(id) as TData | null | undefined;
          if (d != null) return d;
        }
        return null;
      };

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
        const childCommands: DrawCommand[] = [...self];
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

      // Roots: previewing nodes whose parent isn't previewing — buildSubtree
      // recurses down from each.
      const children: DrawCommand[] = [];
      for (const id of idSet) {
        const node = sc.get(asNodeId(id));
        const parent = node?.parent;
        if (parent != null && idSet.has(parent)) continue;
        for (const cmd of buildSubtree(id)) children.push(cmd);
      }
      if (children.length === 0) return [];
      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      // Keep the alpha group so the 0.85 still applies to the ghosts.
      return [{ kind: 'group', alpha: 0.85, children }];
    },
  }), []);
}
