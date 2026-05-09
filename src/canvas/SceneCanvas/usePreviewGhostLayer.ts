/**
 * Preview-ghost render layer for `<SceneCanvas>`. Renders in-flight gesture
 * poses on top of the committed scene by reusing the scene slot's `drawOne` /
 * `drawOneGL`. The active tool publishes which ids are displaced
 * (`previewIds`) and their interim poses (`previewPose`); this layer iterates
 * them and delegates to the slot's draw functions.
 *
 * This replaces the per-tool `drawGhost` fold-in — a single SceneCanvas
 * concern instead of every consumer wiring it.
 */
import { useMemo, useRef } from 'react';
import { viewToMat3, type DrawCommand } from '@orochi235/weasel-gl';
import type { RenderLayer } from '../../core/layers/render';
import type { LayersMap } from '../Canvas';
import type { Node, Scene } from '../../core/scene/types';
import { asNodeId } from '../../core/scene/types';
import type { ToolsApi } from '../../tools/useTools';

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
      const drawOneGL = slot?.drawOneGL;
      if (!slot || !drawOneGL) return [];
      const t = toolsRef.current;
      const tool = t.registry[t.hotkeyEngaged ?? t.active];
      const ids = tool?.previewIds?.();
      if (!ids) return [];
      const sc = sceneRef.current;
      const children: DrawCommand[] = [];
      for (const id of ids) {
        const pose = tool?.previewPose?.(id) as TPose | null | undefined;
        if (pose == null) continue;
        const node = sc.get(asNodeId(id));
        if (!node) continue;
        for (const cmd of drawOneGL(node, pose, view)) children.push(cmd);
      }
      if (children.length === 0) return [];
      return [{ kind: 'group', transform: viewToMat3(view), alpha: 0.85, children }];
    },
  }), []);
}
