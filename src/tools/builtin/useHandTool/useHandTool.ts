import { useMemo, createElement } from 'react';
import { defineViewportTool } from '../../routing';
import type { Tool } from '../../types';
import { HandIcon } from '../../../icons';
import type { View } from 'core/viewport/view';
import { useVelocityTracker } from 'core/viewport/useVelocityTracker';
import { useDecayLoop, type PanBounds } from 'core/viewport/useDecayLoop';

export interface InertiaConfig {
  friction?: number;
  minSpeed?: number;
  /** What to do when inertial pan reaches `bounds`. Default: no clamping. */
  boundary?: 'stop' | 'bounce' | 'spring';
  /** View-coordinate limits for boundary clamping. Requires `boundary` to take effect. */
  bounds?: PanBounds;
}

export interface UseHandToolOptions {
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
  const inertia = opts.inertia === false ? false : opts.inertia;
  const axis = opts.axis ?? 'both';
  const tracker = useVelocityTracker();
  const decay = useDecayLoop();

  return useMemo(
    () =>
      Object.assign(defineViewportTool<HandScratch>({
        id: 'hand',
        capabilities: ['navigation'],
        hookName: 'useHandTool',
        presentation: {
          label: 'Hand',
          icon: createElement(HandIcon),
          group: 'view',
        },
        cursor: 'grab',
        initial: {},
        engaged: {
          cursor: 'grabbing',
        },
      }), {
        // Declarative binding routes drag through the new dispatcher +
        // viewportDragPanAction. The legacy route-table drag block has
        // been removed alongside `Tool.bindingsOverrideDrag`.
        bindings: [{ spec: { kind: 'drag' as const }, actionId: 'viewport.dragPan' }],
      }) as Tool<HandScratch | null>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inertia, axis, tracker, decay],
  );
}
