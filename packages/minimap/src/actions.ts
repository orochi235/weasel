/**
 * The minimap's input: press to recenter the main camera on a world point,
 * drag to keep it there. Both read `rootView` — never `view`, which inside the
 * minimap's own view answers the minimap's camera.
 */
import type { Action, InvocationCtx, OngoingHandle, Tool } from '@weasel-js/routing';
import { viewWorldToScreen, wheelZoomFactor, zoomAt, type ViewApi, type ZoomClampOptions } from '@weasel-js/core';
import type { ImmediateParams } from '@weasel-js/routing';

/** Action id for `minimapCenterAction`. */
export const MINIMAP_CENTER = 'minimap.center';
/** Action id for `minimapPanAction`. */
export const MINIMAP_PAN = 'minimap.pan';
/** Action id for `minimapZoomAction`. */
export const MINIMAP_ZOOM = 'minimap.zoom';

/** Move `root` so world point (`x`, `y`) sits at the center of its host,
 *  keeping its scale. A no-op while the host is unmeasured. */
export function centerRootOn(root: ViewApi, x: number, y: number): void {
  const size = root.hostSize?.();
  if (!size) return;
  const v = root.get();
  root.set({
    x: x - size.width / (2 * v.scale.x),
    y: y - size.height / (2 * v.scale.y),
    scale: v.scale,
  });
}

function rootOf(deps: InvocationCtx['deps']): ViewApi | undefined {
  return deps.rootView;
}

/** Recenter the main camera on the pressed world point. */
export function minimapCenterAction(): Action {
  return {
    id: MINIMAP_CENTER,
    label: 'Minimap — center the view here',
    requires: ['rootView'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const world = (params as ImmediateParams | undefined)?.world;
        const root = rootOf(deps);
        if (!root || !world) return;
        centerRootOn(root, world.x, world.y);
      },
    },
  };
}

/** Keep the main camera centered on the pointer's world point while dragging.
 *  Pair it with `minimap.center` on `pointerDown`, which handles the press.
 *  A recenter lands the moment it is computed, so there is nothing to commit
 *  and a cancel ends where a release does. */
export function minimapPanAction(): Action {
  return {
    id: MINIMAP_PAN,
    label: 'Minimap — pan the view',
    requires: ['rootView'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const root = rootOf(ctx.deps);
        if (!root) return {};
        // The press already centered (`minimap.center`); the move that crossed
        // the drag threshold is pumped to `onMove` like every later one.
        return {
          onMove: (m) => {
            const p = m.drag?.current ?? m.world;
            centerRootOn(root, p.x, p.y);
          },
          onEnd: () => {},
        };
      },
    },
  };
}

/** Zoom the main camera by one wheel or pinch sample about the world point
 *  under the cursor, which keeps its place in the main view. `clamp` is the
 *  main view's zoom limits, or a getter read on each sample; omitted, the kit
 *  defaults `viewport.zoom` also uses. */
export function minimapZoomAction(clamp?: ZoomClampOptions | (() => ZoomClampOptions | undefined)): Action {
  return {
    id: MINIMAP_ZOOM,
    label: 'Minimap — zoom the view',
    requires: ['rootView'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const p = params as ImmediateParams | undefined;
        const root = rootOf(deps);
        if (!root || !p?.world) return;
        // An extreme wheel delta still zooms, to the clamp; a pinch scale that is not a positive step does nothing.
        const pinch = p.scale !== undefined;
        if (pinch ? !(p.scale! > 0 && Number.isFinite(p.scale) && p.scale !== 1) : !p.deltaY) return;
        const factor = pinch ? p.scale! : wheelZoomFactor(p.deltaY!);
        const v = root.get();
        root.set(zoomAt(v, viewWorldToScreen(v, p.world), factor, typeof clamp === 'function' ? clamp() : clamp));
      },
    },
  };
}

/** The minimap's bindings, each id prefixed with `id`: press to center, drag to pan, and with `wheel` the wheel
 *  and a trackpad pinch to zoom, as `viewport.zoom` takes them. `views` scopes them to the minimap's view on a surface that routes several. */
export function minimapBindings(id: string, wheel: boolean, views?: readonly string[]): Tool['bindings'] {
  const scope = views ? { views: [...views] } : {};
  return [
    { spec: { kind: 'pointerDown' }, actionId: MINIMAP_CENTER, opts: { id: `${id}.pointerDown`, ...scope } },
    { spec: { kind: 'drag' }, actionId: MINIMAP_PAN, opts: { id: `${id}.drag`, ...scope } },
    // A trackpad pinch arrives as ctrl+wheel, which a bare-wheel spec rejects, and in Safari as WebKit's pinch.
    ...(wheel ? [
      { spec: { kind: 'wheel' as const }, actionId: MINIMAP_ZOOM, opts: { id: `${id}.wheel`, ...scope } },
      { spec: { kind: 'wheel' as const, mods: { ctrl: true } }, actionId: MINIMAP_ZOOM, opts: { id: `${id}.trackpad`, ...scope } },
      { spec: { kind: 'pinch' as const }, actionId: MINIMAP_ZOOM, opts: { id: `${id}.pinch`, ...scope } },
    ] : []),
  ];
}
