import { useMemo, useRef, createElement } from 'react';
import { defineViewportTool } from '../../defineViewportTool';
import type { Tool } from '../../types';
import { HandIcon } from '../../../icons';
import type { View } from 'core/viewport/view';
import type { InertiaConfig } from 'core/viewport/useDecayLoop';

export type { InertiaConfig };

/** Options for `useHandTool`. Both are forwarded to `viewport.dragPan` as
 *  binding params; momentum additionally needs a `view` dep publishing
 *  `decay`, which `<SceneCanvas>` wires. */
export interface UseHandToolOptions {
  /** Momentum after release. Omit or pass `false` for none. */
  inertia?: false | InertiaConfig;
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

/** @internal */
interface HandScratch {
  startView: View;
  startScreenPoint: { x: number; y: number };
}

/**
 * Pan-on-drag tool. Registered in both the active slot (sticky, `H` key)
 * and the hotkey slot (momentary, hold `space`).
 *
 * Drag handlers compute pan deltas inline. View is read from ctx.view at
 * gesture start and written via ctx.setView on every move — so the tool
 * works with both controlled and uncontrolled Canvas viewport modes
 * without any extra wiring.
 *
 * Sign convention: dragging the mouse right moves the canvas content right
 * relative to the viewport — i.e. the camera moves *left*. So the new view
 * is `{ x: startView.x - dx, y: startView.y - dy }`.
 */
export function useHandTool(opts: UseHandToolOptions = {}): Tool<HandScratch | null> {
  // Read through a ref from a params thunk rather than closing over the
  // values: a consumer passing `inertia={{ friction: 0.9 }}` inline would
  // otherwise mint a new tool identity on every render.
  const optsRef = useRef(opts);
  optsRef.current = opts;
  return useMemo(
    () =>
      Object.assign(defineViewportTool<HandScratch>({
        id: 'hand',
        capabilities: ['navigation'],
        hotkey: 'space',
        hookName: 'useHandTool',
        presentation: {
          label: 'Hand',
          icon: createElement(HandIcon),
          group: 'view',
        },
        cursor: 'grab',
      }), {
        // Declarative binding routes drag through the dispatcher +
        // viewportDragPanAction, which also owns the grabbing cursor
        // (`Action.activeCursor`) the tool used to declare as an `engaged`
        // phase entry.
        bindings: [{
          spec: { kind: 'drag' as const },
          actionId: 'viewport.dragPan',
          opts: {
            params: () => ({
              axis: optsRef.current.axis ?? 'both',
              inertia: optsRef.current.inertia,
            }),
          },
        }],
      }) as Tool<HandScratch | null>,
    [],
  );
}
