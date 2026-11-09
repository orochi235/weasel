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
import { defineTool, type Action, type InvocationCtx, type Tool } from '@weasel-js/routing';
import { dollyToward, orbitBy, panBy, type Camera3d } from './camera';
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

/**
 * Writes `step` of the camera a gesture began on to `dep`, the gesture's input
 * `at` read relative to `zero`. Stepping from that one camera keeps every move
 * exact; when another writer replaces the dep's camera mid-gesture (a wheel
 * dolly during an orbit, a home), the gesture rebases onto that camera from
 * the input it had reached, rather than undoing the write on its next move.
 * A dep still answering with the camera from before this gesture's last write,
 * as a host whose state lands on its next render does, was not replaced.
 */
function cameraStepper<P>(
  dep: Camera3dDep | undefined,
  zero: P,
  relative: (at: P, from: P) => P,
  step: (origin: Camera3d, input: P, dep: Camera3dDep) => Camera3d,
): (at: P) => void {
  let origin = dep?.get();
  let from = zero;
  let reached = zero;
  let written = origin;
  let prior = origin;
  return (at) => {
    if (!dep || !origin) return;
    const now = dep.get();
    if (now !== written && now !== prior) {
      origin = now;
      from = reached;
    }
    prior = now;
    written = step(origin, relative(at, from), dep);
    reached = at;
    dep.set(written);
  };
}

/** An ongoing drag replacing the `camera3d` dep with `step` of the camera as
 *  it was when the drag began. `drag.delta` runs from the drag origin, not the
 *  previous move, so every move composes against that one camera. */
function dragCamera(
  ctx: InvocationCtx,
  kind: string,
  step: (origin: Camera3d, delta: { x: number; y: number }, dep: Camera3dDep) => Camera3d,
) {
  if (!ctx.deps.camera3d) return {};
  const apply = cameraStepper(ctx.deps.camera3d, { x: 0, y: 0 }, (a, b) => ({ x: a.x - b.x, y: a.y - b.y }), step);
  return {
    kind,
    onMove(move: InvocationCtx) {
      const delta = screenDelta(move);
      if (delta) apply(delta);
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

/** Where on the pane a dolly anchors: `at`, a canvas-local point, taken from
 *  the pane's top-left, or the middle of the pane when there is none. */
function paneAnchor(
  at: { x: number; y: number } | undefined,
  dep: Camera3dDep,
  pane: { width: number; height: number },
): { x: number; y: number } {
  if (!at) return { x: pane.width / 2, y: pane.height / 2 };
  const o = dep.origin?.() ?? { x: 0, y: 0 };
  return { x: at.x - o.x, y: at.y - o.y };
}

/** The canvas-local point a wheel event carries, if it carries one. */
function wheelPoint(params: Record<string, unknown> | undefined): { x: number; y: number } | undefined {
  const x = params?.clientX;
  const y = params?.clientY;
  return typeof x === 'number' && typeof y === 'number' ? { x, y } : undefined;
}

/** `camera.dolly`: moves the `camera3d` dep in or out about the point under
 *  the pointer, as a 2D camera's wheel zooms about it. A wheel's `deltaY`, and
 *  a trackpad pinch delivered as ctrl+wheel, dolly by `exp(deltaY × rate)` —
 *  one rate for both, as a 2D camera zooms by both. Safari's pinch arrives as
 *  a `scale` and divides the distance by it. Bound to all three by default, in
 *  every tool. */
export const dollyAction: Action = {
  id: 'camera.dolly',
  label: 'Dolly',
  group: 'viewport',
  defaultBinding: [
    { spec: { kind: 'wheel' }, opts: { id: 'camera.dolly.wheel' } },
    // Unbound, a trackpad pinch zooms the page instead.
    { spec: { kind: 'wheel', mods: { ctrl: true } }, opts: { id: 'camera.dolly.trackpadPinch' } },
    { spec: { kind: 'pinch' }, opts: { id: 'camera.dolly.pinch' } },
  ],
  requires: ['camera3d', 'kitSettings'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const dep = deps.camera3d;
      if (!dep) return 'pass';
      const factor = typeof params?.scale === 'number'
        ? 1 / params.scale
        : Math.exp(
          (typeof params?.deltaY === 'number' ? params.deltaY : 0)
            * (deps.kitSettings?.get('orbit3d.dollyRate') ?? DOLLY_RATE),
        );
      if (!(factor > 0) || !Number.isFinite(factor) || factor === 1) return 'pass';
      const pane = dep.size();
      dep.set(dollyToward(dep.get(), factor, paneAnchor(wheelPoint(params), dep, pane), pane, dep.limits?.()));
      return undefined;
    },
  },
};

/** `camera.pinchDolly`: two fingers spreading dolly the `camera3d` dep in and
 *  closing dolly it out, by the ratio of their spread, about where they began. */
export const pinchDollyAction: Action = {
  id: 'camera.pinchDolly',
  label: 'Pinch Dolly',
  group: 'viewport',
  defaultBinding: [{ spec: { kind: 'multiTouch', fingers: 2 }, opts: { id: 'camera.pinchDolly.multiTouch' } }],
  requires: ['camera3d'],
  invoker: {
    timing: 'ongoing',
    start(ctx) {
      const dep = ctx.deps.camera3d;
      if (!dep) return {};
      const startSpread = ctx.multiTouch?.spread ?? 0;
      const at = ctx.multiTouch?.centroid;
      const apply = cameraStepper(dep, 1, (a, b) => a / b, (origin, factor, d) => {
        const pane = d.size();
        return dollyToward(origin, factor, paneAnchor(at, d, pane), pane, d.limits?.());
      });
      return {
        kind: 'pinch',
        onMove(move) {
          const spread = move.multiTouch?.pinch?.currentSpread ?? 0;
          if (!(startSpread > 0) || !(spread > 0)) return;
          apply(startSpread / spread);
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
  defaultBinding: [{ spec: { kind: 'doubleClick' }, opts: { id: 'camera.home.doubleClick' } }],
  requires: ['camera3d'],
  invoker: {
    timing: 'immediate',
    run(deps) {
      const dep = deps.camera3d;
      const home = dep?.home?.();
      if (!dep || !home) return 'pass';
      dep.set(home);
      return undefined;
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
    presentation: { label: 'Orbit', group: 'view' },
    bindings: [
      { spec: { kind: 'drag' }, actionId: 'camera.orbit', opts: { id: 'orbit.orbit' } },
      { spec: { kind: 'drag', mods: { shift: true } }, actionId: 'camera.pan', opts: { id: 'orbit.pan' } },
    ],
  }), []);
}
