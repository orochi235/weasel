/**
 * The bone and weight tools as `<SceneCanvas>` mounts them: on the canvas's
 * own scene, sharing one `RigEditState`, and acting on the rig the selection
 * names unless `toolOptions.rig` fixes one.
 *
 * Both hooks always run (React rules of hooks); `resolveToolRegistry` decides
 * which the canvas registers.
 */
import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { NodeId, Scene } from 'core/scene/types';
import type { RigNodeData } from '../../animation/rig/rigNode';
import { useBoneTool } from 'tools/builtin/bone/useBoneTool';
import { createRigEditState } from 'tools/builtin/bone/rigEditState';
import { useWeightTool } from 'tools/builtin/weight/useWeightTool';
import type { Tool } from 'tools/overlayBinding';
import type { BuiltinToolOptions } from './useBuiltinShapeTools';

/**
 * The rig a selection names: with one node selected, the nearest of it and its
 * ancestors whose `data.skeleton` exists, else that node itself, so a first
 * bone can be drawn onto it. With none or several selected, `null`.
 */
export function rigOfSelection(
  scene: { get(id: NodeId): { parent: NodeId | null; data?: unknown } | undefined },
  ids: readonly NodeId[],
): NodeId | null {
  if (ids.length !== 1) return null;
  const own = ids[0];
  for (let id: NodeId | null = own; id !== null;) {
    const node = scene.get(id);
    if (!node) break;
    if ((node.data as RigNodeData | null | undefined)?.skeleton) return id;
    id = node.parent;
  }
  return scene.get(own) ? own : null;
}

export interface UseBuiltinRigToolsArgs {
  scene: Scene<unknown, string, unknown>;
  /** The canvas's selection, read when a tool acts. */
  selection: () => readonly NodeId[];
  options?: BuiltinToolOptions;
}

export function useBuiltinRigTools(args: UseBuiltinRigToolsArgs): { bone: Tool; weight: Tool } {
  const { scene, options } = args;
  const latest = useLatest({ scene, selection: args.selection, rig: options?.rig?.rig });
  const rig = useMemo(() => (): NodeId | null => {
    const { scene: s, selection, rig: fixed } = latest.current;
    return fixed ? fixed() : rigOfSelection(s, selection());
  }, [latest]);
  const ownState = useMemo(() => createRigEditState(), []);
  const state = options?.rig?.state ?? ownState;
  const reach = options?.rig?.reach;
  const bone = useBoneTool({ scene, rig, state, reach });
  const weight = useWeightTool({ scene, rig, state, reach, radius: options?.weight?.radius });
  return { bone, weight };
}
