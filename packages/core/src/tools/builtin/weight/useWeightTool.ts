import { useMemo, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import type { ToolKeybinding } from '@weasel-js/routing';
import type { NodeId, Scene } from 'core/scene/types';
import type { Skin } from '@weasel-js/animator';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { createBoneOverlay } from '../bone/boneOverlay';
import { placedRig } from '../bone/placedRig';
import { createRigEditState, type RigEditState } from '../bone/rigEditState';
import { createWeightActions, weighedPaths, type WeightEnv } from './weightActions';
import { createWeightOverlay } from './weightOverlay';

/** Options for `useWeightTool`. */
export interface UseWeightToolOptions {
  scene: Scene<unknown, string, unknown>;
  /** The node whose data holds the skeleton; the tool paints the paths under it. */
  rig: () => NodeId | null;
  /** Shared with `useBoneTool`, so both act on one joint. Default: the tool's own. */
  state?: RigEditState;
  /** Override the default keybinding (`{ key: 'W' }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** The brush's radius in screen px. Default 24. */
  radius?: number;
  /** Screen px around a joint within which a click picks it. Default 10. */
  reach?: number;
}

const NONE: ReadonlyMap<NodeId, Skin> = new Map();

/**
 * Paints how much the active joint weighs each point of the paths under a rig node, into
 * their `data.skin`. A click on a joint makes it the active one. A drag is a round brush:
 * points under it follow the active joint more, the nearer the brush's center, and their
 * other joints give way; with Alt held they follow it less. A click away from any joint is
 * one dab. Every point shows as a dot colored by the active joint's share of it. A stroke is
 * one undo entry.
 */
export function useWeightTool(options: UseWeightToolOptions): Tool {
  const ownState = useMemo(() => createRigEditState(), []);
  const state = options.state ?? ownState;
  const opts = useLatest({
    scene: options.scene, rig: options.rig, radius: options.radius ?? 24, reach: options.reach ?? 10,
  });
  const paintedRef = useRef(NONE);

  const env = useMemo(() => {
    const listeners = new Set<() => void>();
    const tool: WeightEnv & { listen(fn: () => void): () => void } = {
      state,
      scene: () => opts.current.scene,
      placed: () => placedRig(opts.current.scene, opts.current.rig()),
      reachPx: () => opts.current.reach,
      radiusPx: () => opts.current.radius,
      painted: () => paintedRef.current,
      paint(next) {
        paintedRef.current = next ?? NONE;
        for (const fn of [...listeners]) fn();
      },
      listen(fn) {
        listeners.add(fn);
        const off = state.listen(fn);
        return () => { listeners.delete(fn); off(); };
      },
    };
    return tool;
  }, [opts, state]);

  const actions = useMemo(() => createWeightActions(env), [env]);
  const overlay = useMemo(() => [
    createWeightOverlay({
      id: 'weight-tool-points',
      paths: () => weighedPaths(env),
      active: state.active,
      subscribe: env.listen,
    }),
    createBoneOverlay({
      id: 'weight-tool-skeleton',
      skeleton: () => env.placed()?.skeleton ?? null,
      active: state.active,
      subscribe: env.listen,
    }),
  ], [env, state]);

  const { keybinding } = options;
  return useMemo(() => defineTool({
    id: 'weight',
    capabilities: ['edits-page'],
    hookName: 'useWeightTool',
    cursor: 'crosshair',
    presentation: { label: 'Weight', group: 'shape' },
    ...(keybinding === null ? {} : { keybinding: keybinding ?? { key: 'W' } }),
    actions,
    overlay,
    onDeactivate: () => env.paint(null),
    bindings: [
      { spec: { kind: 'click', mods: { shift: 'optional', alt: 'optional' } }, actionId: 'weight.click' },
      { spec: { kind: 'drag', mods: { shift: 'optional', alt: 'optional' } }, actionId: 'weight.paint' },
    ],
  }), [actions, overlay, keybinding, env]);
}
