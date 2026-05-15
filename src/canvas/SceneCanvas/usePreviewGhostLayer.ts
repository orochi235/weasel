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
import { useMemo, useRef } from 'react';
import { viewToMat3, type DrawCommand } from '../../renderer';
import type { RenderLayer } from 'core/layers/render';
import type { LayersMap } from '../Canvas';
import type { Node, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { ToolsApi } from 'tools/useTools';

export function usePreviewGhostLayer<TData, TLayer extends string, TPose>(args: {
  scene: Scene<TData, TLayer, TPose>;
  tools: ToolsApi;
  sceneSlot: LayersMap<Node<TData, TLayer, TPose>, TPose>['scene'];
}): RenderLayer<unknown> {
  const { scene, tools, sceneSlot } = args;

  // Refs let the layer body read the latest scene/tools/slot without
  // re-creating the layer on every host render.
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const toolsRef = useRef(tools);
  toolsRef.current = tools;
  const sceneSlotRef = useRef(sceneSlot);
  sceneSlotRef.current = sceneSlot;

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
      const tools: { previewIds?: () => Iterable<string> | null; previewPose?: (id: string) => unknown }[] = [];
      const push = (tool: typeof tools[number] | undefined) => {
        if (!tool || seen.has(tool)) return;
        seen.add(tool);
        tools.push(tool);
      };
      if (t.hotkeyEngaged) push(t.registry[t.hotkeyEngaged]);
      push(t.registry[t.active]);
      for (const tool of Object.values(t.registry)) push(tool);
      for (const tool of t.ambient) push(tool);
      const idSet = new Set<string>();
      for (const tool of tools) {
        const ids = tool.previewIds?.();
        if (!ids) continue;
        for (const id of ids) idSet.add(id);
      }
      if (idSet.size === 0) return [];
      const sc = sceneRef.current;
      const children: DrawCommand[] = [];
      for (const id of idSet) {
        let pose: TPose | null | undefined;
        for (const tool of tools) {
          const p = tool.previewPose?.(id) as TPose | null | undefined;
          if (p != null) { pose = p; break; }
        }
        if (pose == null) continue;
        const node = sc.get(asNodeId(id));
        if (!node) continue;
        for (const cmd of drawOne(node, pose, view)) children.push(cmd);
      }
      if (children.length === 0) return [];
      return [{ kind: 'group', transform: viewToMat3(view), alpha: 0.85, children }];
    },
  }), []);
}
