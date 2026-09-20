/**
 * Camera tools and their actions.
 *
 * Shape tools transfer from the kit untouched — a 3D host mounts core's own
 * `useSelectTool` and a rectangle-style insert binding and neither notices the
 * dimension. Only the viewport tools are written here, which is the one
 * exception the kernel doc predicted: `useHandTool` routes to
 * `viewport.dragPan`, and that wants the 2D `view`.
 */

import { defineTool, type Action, type Tool } from '@weasel-js/core';
import { dollyBy, orbitBy, type Camera3d } from './camera';
import type { Camera3dDep } from './cameraDep';

/** Radians per CSS pixel of drag. A full pane width is a bit over half a turn. */
const ORBIT_RATE = 0.006;
const DOLLY_RATE = 0.0015;

function cameraDep(deps: unknown): Camera3dDep | undefined {
  return (deps as { camera3d?: Camera3dDep }).camera3d;
}

export const orbitAction: Action = {
  id: 'camera.orbit',
  label: 'Orbit',
  requires: ['camera3d'],
  invoker: {
    timing: 'ongoing',
    start(ctx) {
      const dep = cameraDep(ctx.deps);
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
      const dep = cameraDep(deps);
      if (!dep) return;
      const amount = typeof params?.deltaY === 'number' ? params.deltaY : 0;
      dep.set(dollyBy(dep.get(), Math.exp(amount * DOLLY_RATE)));
    },
  },
};

export function useOrbitTool(): Tool<null> {
  return defineTool<null>({
    id: 'orbit',
    hookName: 'useOrbitTool',
    cursor: 'grab',
    presentation: { label: 'Orbit', group: 'viewport' },
    bindings: [{ spec: { kind: 'drag' }, actionId: 'camera.orbit' }],
  });
}
