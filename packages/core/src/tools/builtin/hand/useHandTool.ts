import { useMemo, createElement } from 'react';
import { defineViewportTool } from '../../defineViewportTool';
import type { Tool } from '../../types';
import { HandIcon } from '../../../icons';
import type { View } from 'core/viewport/view';
import type { PanBounds } from 'core/viewport/useDecayLoop';

/** Momentum settings for the hand tool: how quickly a flung view slows, when
 *  it stops, and what happens at the pan limits. */
export interface InertiaConfig {
  friction?: number;
  minSpeed?: number;
  /** What to do when inertial pan reaches `bounds`. Default: no clamping. */
  boundary?: 'stop' | 'bounce' | 'spring';
  /** View-coordinate limits for boundary clamping. Requires `boundary` to take effect. */
  bounds?: PanBounds;
}

/** Options for `useHandTool`.
 *
 * Neither field is wired yet: the tool's only binding routes `drag` to
 * `viewport.dragPan`, which implements neither momentum nor axis locking. */
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
export function useHandTool(_opts: UseHandToolOptions = {}): Tool<HandScratch | null> {
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
        bindings: [{ spec: { kind: 'drag' as const }, actionId: 'viewport.dragPan' }],
      }) as Tool<HandScratch | null>,
    [],
  );
}
