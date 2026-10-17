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
import { defineTool, type Action, type InvocationCtx, type Tool } from '@weasel-js/core';
import { dollyBy, orbitBy, panBy, type Camera3d } from './camera';
import type { Camera3dDep } from './cameraDep';

/** Radians per CSS pixel of drag. A full pane width is a bit over half a turn. */
export const ORBIT_RATE = 0.006;
/** Dolly exponent per unit of wheel `deltaY`. */
export const DOLLY_RATE = 0.0015;

/**
 * The drag's cumulative client-pixel delta.
 *
 * The fallback is only sound because a 3D host's `clientToWorld` is identity
 * (see `overlays.ts`), so the world delta already is the client one. Don't copy
 * this to a host with a 2D view — there the two spaces differ by the zoom.
 */
function screenDelta(move: InvocationCtx): { x: number; y: number } | undefined {
  return move.drag?.screenDelta ?? move.drag?.delta;
}

/** An ongoing drag replacing the `camera3d` dep with `step` of the camera as
 *  it was when the drag began. `drag.delta` runs from the drag origin, not the
 *  previous move, so every move composes against that one camera. */
function dragCamera(
  ctx: InvocationCtx,
  kind: string,
  step: (origin: Camera3d, delta: { x: number; y: number }, dep: Camera3dDep) => Camera3d,
) {
  const dep = ctx.deps.camera3d;
  const origin: Camera3d | undefined = dep?.get();
  return {
    kind,
    onMove(move: InvocationCtx) {
      const delta = screenDelta(move);
      if (!dep || !origin || !delta) return;
      dep.set(step(origin, delta, dep));
    },
  };
}

/** `camera.orbit`: an ongoing drag that turns the `camera3d` dep about its
 *  target. */
export const orbitAction: Action = {
  id: 'camera.orbit',
  label: 'Orbit',
  group: 'viewport',
  cursor: 'grab',
  activeCursor: 'grabbing',
  requires: ['camera3d', 'kitSettings'],
  invoker: {
    timing: 'ongoing',
    start(ctx) {
      const rate = ctx.deps.kitSettings?.get('orbit3d.orbitRate') ?? ORBIT_RATE;
      return dragCamera(ctx, 'orbit', (origin, d, dep) =>
        orbitBy(origin, -d.x * rate, d.y * rate, dep.limits?.()));
    },
  },
};

/** `camera.pan`: an ongoing drag that slides the `camera3d` dep's target
 *  across the screen plane, so the point at the target follows the pointer. */
export const panAction: Action = {
  id: 'camera.pan',
  label: 'Pan',
  group: 'viewport',
  cursor: 'move',
  requires: ['camera3d'],
  invoker: {
    timing: 'ongoing',
    start(ctx) {
      return dragCamera(ctx, 'pan', (origin, d, dep) =>
        panBy(origin, d.x, d.y, dep.size().height));
    },
  },
};

/** `camera.dolly`: moves the `camera3d` dep toward or away from its target.
 *  A wheel's `deltaY`, and a trackpad pinch delivered as ctrl+wheel, dolly by
 *  `exp(deltaY × rate)` — one rate for both, as a 2D camera zooms by both.
 *  Safari's pinch arrives as a `scale` and divides the distance by it. Bound
 *  to all three by default, in every tool. */
export const dollyAction: Action = {
  id: 'camera.dolly',
  label: 'Dolly',
  group: 'viewport',
  defaultBinding: [
    { spec: { kind: 'wheel' }, opts: {} },
    // Unbound, a trackpad pinch zooms the page instead.
    { spec: { kind: 'wheel', mods: { ctrl: true } }, opts: {} },
    { spec: { kind: 'pinch' }, opts: {} },
  ],
  requires: ['camera3d', 'kitSettings'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const dep = deps.camera3d;
      if (!dep) return;
      const factor = typeof params?.scale === 'number'
        ? 1 / params.scale
        : Math.exp(
          (typeof params?.deltaY === 'number' ? params.deltaY : 0)
            * (deps.kitSettings?.get('orbit3d.dollyRate') ?? DOLLY_RATE),
        );
      if (!(factor > 0) || !Number.isFinite(factor)) return;
      dep.set(dollyBy(dep.get(), factor, dep.limits?.()));
    },
  },
};

/** `camera.pinchDolly`: two fingers spreading dolly the `camera3d` dep in and
 *  closing dolly it out, by the ratio of their spread. */
export const pinchDollyAction: Action = {
  id: 'camera.pinchDolly',
  label: 'Pinch Dolly',
  group: 'viewport',
  defaultBinding: { kind: 'multiTouch', fingers: 2 },
  requires: ['camera3d'],
  invoker: {
    timing: 'ongoing',
    start(ctx) {
      const dep = ctx.deps.camera3d;
      const origin: Camera3d | undefined = dep?.get();
      const startSpread = ctx.multiTouch?.spread ?? 0;
      return {
        kind: 'pinch',
        onMove(move) {
          const spread = move.multiTouch?.pinch?.currentSpread ?? 0;
          if (!dep || !origin || !(startSpread > 0) || !(spread > 0)) return;
          dep.set(dollyBy(origin, startSpread / spread, dep.limits?.()));
        },
      };
    },
  },
};

/** `camera.home`: returns the `camera3d` dep to its `home`. Bound to a double
 *  click by default. */
export const homeAction: Action = {
  id: 'camera.home',
  label: 'Reset Camera',
  group: 'viewport',
  defaultBinding: { kind: 'doubleClick' },
  requires: ['camera3d'],
  invoker: {
    timing: 'immediate',
    run(deps) {
      const dep = deps.camera3d;
      const home = dep?.home?.();
      if (dep && home) dep.set(home);
    },
  },
};

/** A tool that binds a drag to `camera.orbit` and Shift+drag to `camera.pan`.
 *  Register both actions alongside it; the tool only declares the bindings. */
export function useOrbitTool(): Tool {
  return useMemo(() => defineTool({
    id: 'orbit',
    hookName: 'useOrbitTool',
    cursor: 'grab',
    presentation: { label: 'Orbit', group: 'viewport' },
    bindings: [
      { spec: { kind: 'drag' }, actionId: 'camera.orbit' },
      { spec: { kind: 'drag', mods: { shift: true } }, actionId: 'camera.pan' },
    ],
  }), []);
}
