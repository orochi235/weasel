import { useMemo, useRef } from 'react';
import { useKitSettings, useLatest } from '@weasel-js/react';
import type { ToolKeybinding } from '@weasel-js/routing';
import type { NodeId, Scene } from '@weasel-js/core';
import type { Skeleton } from '@weasel-js/animator';
import { defineTool } from '@weasel-js/core';
import type { Tool } from '@weasel-js/core';
import { createBoneActions, type BoneEnv } from './boneActions';
import { createBoneOverlay } from './boneOverlay';
import { placedRig } from './placedRig';
import { createRigEditState, type RigEditState } from './rigEditState';
import { createEmitter } from '@weasel-js/registry';
import { icon } from '../icons.gen';

/** Options for `useBoneTool`. */
export interface UseBoneToolOptions {
  scene: Scene<unknown, string, unknown>;
  /** The node whose data holds the skeleton, or will once a bone is drawn: usually read from
   *  the selection. `null` leaves the tool with nothing to edit. */
  rig: () => NodeId | null;
  /** Shared with `useWeightTool`, so both act on one joint. Default: the tool's own. */
  state?: RigEditState;
  /** Override the default keybinding (`{ key: 'J' }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** Screen px around a joint within which a press takes it. Default 10. */
  reach?: number;
}

/**
 * Draws and edits the skeleton in a node's `data.skeleton`. A drag on a joint moves it, with
 * the joints under it; a drag from anywhere else draws a bone, from the active joint if there
 * is one and from the press if not, and the new joint becomes the active one. A click picks
 * the active joint or clears it, Delete removes it with everything under it, taking its
 * weights out of every skin beneath the rig node, and Escape clears it. Each edit is one undo
 * entry.
 */
export function useBoneTool(options: UseBoneToolOptions): Tool {
  const ownState = useMemo(() => createRigEditState(), []);
  const state = options.state ?? ownState;
  const opts = useLatest({ scene: options.scene, rig: options.rig, reach: options.reach ?? 10 });
  /** The skeleton a drag is shaping, in the scene's space. */
  const liveRef = useRef<Skeleton | null>(null);

  const env = useMemo(() => {
    const changed = createEmitter();
    const tool: BoneEnv & { listen(fn: () => void): () => void } = {
      state,
      scene: () => opts.current.scene,
      reachPx: () => opts.current.reach,
      placed: () => placedRig(opts.current.scene, opts.current.rig()),
      shown: () => liveRef.current,
      show(skeleton) {
        liveRef.current = skeleton;
        changed.emit();
      },
      listen(fn) {
        const offOwn = changed.subscribe(fn);
        const off = state.listen(fn);
        return () => { offOwn(); off(); };
      },
    };
    return tool;
  }, [opts, state]);

  const actions = useMemo(() => createBoneActions(env), [env]);
  const kitSettings = useKitSettings();
  const overlay = useMemo(() => createBoneOverlay({
    id: 'bone-tool-skeleton',
    skeleton: () => env.shown() ?? env.placed()?.skeleton ?? null,
    active: state.active,
    subscribe: env.listen,
    jointRadiusPx: () => kitSettings.get('targets.boneJointRadiusPx'),
  }), [env, state, kitSettings]);

  const { keybinding } = options;
  return useMemo(() => defineTool({
    id: 'bone',
    capabilities: ['edits-page'],
    hookName: 'useBoneTool',
    cursor: 'crosshair',
    presentation: { label: 'Bone', icon: icon('bone'), group: 'shape' },
    ...(keybinding === null ? {} : { keybinding: keybinding ?? { key: 'J' } }),
    actions,
    overlay,
    onDeactivate: () => env.show(null),
    bindings: [
      { spec: { kind: 'click', mods: { shift: 'optional', alt: 'optional' } }, actionId: 'bone.pick', opts: { id: 'bone.pick' } },
      { spec: { kind: 'drag', mods: { shift: 'optional', alt: 'optional' } }, actionId: 'bone.drag', opts: { id: 'bone.drag' } },
      { spec: { kind: 'key', key: ['Delete', 'Backspace'] }, actionId: 'bone.remove', opts: { id: 'bone.remove' } },
      { spec: { kind: 'key', key: 'Escape' }, actionId: 'bone.clear', opts: { id: 'bone.clear' } },
    ],
  }), [actions, overlay, keybinding, env]);
}
