/**
 * Camera tools and their actions.
 *
 * Shape tools transfer from the kit untouched — a 3D host mounts core's own
 * `useSelectTool` and a rectangle-style insert binding and neither notices the
 * dimension. Only the viewport tools are written here, which is the one
 * exception the kernel doc predicted: `useHandTool` routes to
 * `viewport.dragPan`, and that wants the 2D `view`.
 */

import { useMemo } from 'react';
import { defineTool, type Action, type Tool } from '@weasel-js/core';
import { dollyBy, orbitBy, type Camera3d } from './camera';

/** Radians per CSS pixel of drag. A full pane width is a bit over half a turn. */
const ORBIT_RATE = 0.006;
const DOLLY_RATE = 0.0015;

/** `camera.orbit`: an ongoing drag that turns the `camera3d` dep about its
 *  target, relative to the camera as it was when the drag began. */
export const orbitAction: Action = {
  id: 'camera.orbit',
  label: 'Orbit',
  requires: ['camera3d'],
  invoker: {
    timing: 'ongoing',
    start(ctx) {
      const dep = ctx.deps.camera3d;
      const origin: Camera3d | undefined = dep?.get();
      return {
        kind: 'orbit',
        onMove(move) {
          if (!dep || !origin) return;
          // `drag.delta` runs from the drag origin, not the previous move, so
          // this composes against the camera as it was when the drag began.
          //
          // The fallback is only sound here because a 3D host's `clientToWorld`
          // is identity (see `overlays.ts`), so the world delta already is the
          // client one. Don't copy this pair to a host with a 2D view — there
          // the two spaces differ by the zoom.
          const delta = move.drag?.screenDelta ?? move.drag?.delta;
          if (!delta) return;
          dep.set(orbitBy(origin, -delta.x * ORBIT_RATE, delta.y * ORBIT_RATE));
        },
      };
    },
  },
};

/** `camera.dolly`: moves the `camera3d` dep toward or away from its target by
 *  the wheel's `deltaY`. Bound to the wheel by default, in every tool. */
export const dollyAction: Action = {
  id: 'camera.dolly',
  label: 'Dolly',
  group: 'viewport',
  // Wheel, in any tool — the dispatcher merges the event's deltas into params.
  defaultBinding: [{ spec: { kind: 'wheel' }, opts: {} }],
  requires: ['camera3d'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const dep = deps.camera3d;
      if (!dep) return;
      const amount = typeof params?.deltaY === 'number' ? params.deltaY : 0;
      dep.set(dollyBy(dep.get(), Math.exp(amount * DOLLY_RATE)));
    },
  },
};

/** A tool that binds drag to `camera.orbit`. Register `orbitAction` alongside
 *  it; the tool only declares the binding. */
export function useOrbitTool(): Tool<null> {
  return useMemo(() => defineTool<null>({
    id: 'orbit',
    hookName: 'useOrbitTool',
    cursor: 'grab',
    presentation: { label: 'Orbit', group: 'viewport' },
    bindings: [{ spec: { kind: 'drag' }, actionId: 'camera.orbit' }],
  }), []);
}
