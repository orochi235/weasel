import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { NodeId, RigNodeData, Scene, Tool } from '@weasel-js/core';
import { useBoneTool } from './bone/useBoneTool';
import { createRigEditState, type RigEditState } from './bone/rigEditState';
import { useWeightTool } from './weight/useWeightTool';
import type { RigToolId } from './toolSets';

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

/** Options for {@link useRigTools}. */
export interface UseRigToolsOptions {
  /** The scene the tools edit: the one given to `<SceneCanvas>`. */
  scene: Scene<unknown, string, unknown>;
  /** The selection that names the rig, read when a tool acts. Default the scene's own,
   *  which is the canvas's unless `<SceneCanvas selection>` supplies another. */
  selection?: () => readonly NodeId[];
  /** Fixes the rig node, in place of the one the selection names. */
  rig?: () => NodeId | null;
  /** The joint both tools act on and the stroke being painted. Hand the same one to
   *  `useRigNode` as `painting` so a stroke shows as it is painted. Default the hook's own. */
  state?: RigEditState;
  /** Screen px around a joint within which a press takes it. */
  reach?: number;
  /** The weight tool's brush radius, in screen px. */
  radius?: number;
}

/**
 * Every tool in {@link RIG_TOOLS}, keyed by id, for `<SceneCanvas tools>`: the bone and
 * weight tools on one scene, sharing one `RigEditState`, and acting on the rig the
 * selection names unless `rig` fixes one.
 */
export function useRigTools(options: UseRigToolsOptions): Record<RigToolId, Tool> {
  const { scene } = options;
  const latest = useLatest({ scene, selection: options.selection, rig: options.rig });
  const rig = useMemo(() => (): NodeId | null => {
    const { scene: s, selection, rig: fixed } = latest.current;
    return fixed ? fixed() : rigOfSelection(s, selection ? selection() : s.getSelection());
  }, [latest]);
  const ownState = useMemo(() => createRigEditState(), []);
  const state = options.state ?? ownState;
  const { reach, radius } = options;
  const bone = useBoneTool({ scene, rig, state, reach });
  const weight = useWeightTool({ scene, rig, state, reach, radius });
  return useMemo(() => ({ bone, weight }), [bone, weight]);
}
