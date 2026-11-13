import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import type { InertiaConfig } from 'core/viewport/useDecayLoop';
import { icon } from '../../../icons.gen';
import { THROUGH_CHROME } from '../throughChrome';

const ANY_MODS = { alt: 'optional', ctrl: 'optional', meta: 'optional', shift: 'optional' } as const;

export type { InertiaConfig };

/** Options for `useHandTool`. Both are forwarded to `viewport.dragPan` as
 *  binding params; momentum additionally needs a `view` dep publishing
 *  `decay`, which `<SceneCanvas>` wires. */
export interface UseHandToolOptions {
  /** Momentum after release: `true` for the kit defaults, or the settings.
   *  Omit or pass `false` for none. */
  inertia?: boolean | InertiaConfig;
  /**
   * Which axes the drag responds to. Default `'both'`.
   *
   * - `'both'` — pan both axes (default).
   * - `'x'` — drag only changes `view.x`. Inertia (if enabled) also stays on x.
   * - `'y'` — drag only changes `view.y`. Inertia stays on y.
   *
   * Locks drag panning to a single axis. The former `useWheelPanTool` /
   * `useWheelZoomTool` / `useKeyboardZoomTool` axis option is dissolved.
   */
  axis?: 'both' | 'x' | 'y';
}

/**
 * Pan-on-drag tool. Registered in both the active slot (sticky, `H` key)
 * and the hotkey slot (momentary, hold `space`).
 *
 * A declarative shell: its one binding routes a drag to the
 * `viewport.dragPan` action, which owns the gesture, the view writes, and
 * the grabbing cursor. The tool only passes `axis` and `inertia` along.
 */
export function useHandTool(opts: UseHandToolOptions = {}): Tool {
  // Read through a ref from a params thunk rather than closing over the
  // values: a consumer passing `inertia={{ friction: 0.9 }}` inline would
  // otherwise mint a new tool identity on every render.
  const optsRef = useLatest(opts);
  return useMemo(
    () =>
      defineTool({
        id: 'hand',
        keybinding: { key: 'H' },
        capabilities: ['navigation'],
        hotkey: 'space',
        hookName: 'useHandTool',
        presentation: {
          label: 'Hand',
          icon: icon('hand'),
          group: 'view',
        },
        cursor: 'grab',
        // `viewport.dragPan` owns the gesture and the grabbing cursor (`Action.activeCursor`).
        bindings: [{
          // Any modifiers: the hand always pans, so a held key never hands the drag to a move or a clone.
          spec: { kind: 'drag' as const, target: THROUGH_CHROME, mods: ANY_MODS },
          actionId: 'viewport.dragPan',
          opts: {
            id: 'hand.drag',
            params: () => ({
              axis: optsRef.current.axis ?? 'both',
              inertia: optsRef.current.inertia,
            }),
          },
        }],
      }),
    [optsRef],
  );
}
