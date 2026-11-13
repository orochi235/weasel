/**
 * The minimap's input: press to recenter the main camera on a world point,
 * drag to keep it there, wheel or pinch to zoom it. Every action moves
 * `rootView`, the main camera; `view` is the minimap's own camera, which only
 * the touch pinch reads, to find the world point between its fingers.
 */
import type { Action, InvocationCtx, OngoingHandle, Tool } from '@weasel-js/routing';
import {
  viewScreenToWorld, viewWorldToScreen, wheelZoomFactor, zoomAt, type View, type ViewApi, type ZoomClampOptions,
} from '@weasel-js/core';
import type { ImmediateParams } from '@weasel-js/routing';

/** Action id for `minimapCenterAction`. */
export const MINIMAP_CENTER = 'minimap.center';
/** Action id for `minimapPanAction`. */
export const MINIMAP_PAN = 'minimap.pan';
/** Action id for `minimapZoomAction`. */
export const MINIMAP_ZOOM = 'minimap.zoom';
/** Action id for `minimapPinchAction`. */
export const MINIMAP_PINCH = 'minimap.pinch';

/** The main view's zoom limits, as an action takes them: fixed, read on each sample, or the kit defaults. */
export type MinimapZoomClamp = ZoomClampOptions | (() => ZoomClampOptions | undefined);

const clampOf = (clamp: MinimapZoomClamp | undefined): ZoomClampOptions | undefined =>
  (typeof clamp === 'function' ? clamp() : clamp);

/** `v` zoomed by `factor` about world point `at`, which keeps its place on screen. */
function zoomedAbout(v: View, at: { x: number; y: number }, factor: number, clamp: MinimapZoomClamp | undefined): View {
  return zoomAt(v, viewWorldToScreen(v, at), factor, clampOf(clamp));
}

// Main cameras a touch pinch is steering. The finger that opened a pan keeps it through the pinch, and holds still.
const pinching = new WeakSet<ViewApi>();

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
        // Where the main camera's center sits from the pointer. Zero from the press, which centered
        // (`minimap.center`); a pinch the pan sat out moves the center, so the pan resumes from where it left it.
        let offset = { x: 0, y: 0 };
        let last = ctx.drag?.current ?? ctx.world;
        let rebase = false;
        return {
          onMove: (m) => {
            const p = m.drag?.current ?? m.world;
            if (pinching.has(root)) {
              rebase = true;
              last = p;
              return;
            }
            if (rebase) {
              const c = centerOf(root);
              if (c) offset = { x: c.x - last.x, y: c.y - last.y };
              rebase = false;
            }
            last = p;
            centerRootOn(root, p.x + offset.x, p.y + offset.y);
          },
          onEnd: () => {},
        };
      },
    },
  };
}

/** The world point at the center of `root`'s host, or `null` while it is unmeasured. */
function centerOf(root: ViewApi): { x: number; y: number } | null {
  const size = root.hostSize?.();
  if (!size) return null;
  const v = root.get();
  return { x: v.x + size.width / (2 * v.scale.x), y: v.y + size.height / (2 * v.scale.y) };
}

/** Zoom the main camera by one wheel or pinch sample about the world point
 *  under the cursor, which keeps its place in the main view. `clamp` is the
 *  main view's zoom limits, or a getter read on each sample; omitted, the kit
 *  defaults `viewport.zoom` also uses. */
export function minimapZoomAction(clamp?: MinimapZoomClamp): Action {
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
        root.set(zoomedAbout(root.get(), p.world, factor, clamp));
      },
    },
  };
}

/** Zoom the main camera with a two-finger touch pinch, by the ratio of the fingers' spread, about the world point
 *  between them, read through the minimap's own camera (`view`). That point keeps its place in the main view as
 *  the fingers move, so the main view follows them as a one-finger pan does. `clamp` is as `minimapZoomAction`'s. */
export function minimapPinchAction(clamp?: MinimapZoomClamp): Action {
  return {
    id: MINIMAP_PINCH,
    label: 'Minimap — pinch to zoom the view',
    requires: ['rootView', 'view'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const root = rootOf(ctx.deps);
        const camera = ctx.deps.view;
        const mt = ctx.multiTouch;
        if (!root || !camera || !mt) return {};
        let spread = mt.spread;
        let at = viewScreenToWorld(camera.get(), mt.centroid);
        pinching.add(root);
        return {
          kind: 'pinch',
          onMove(m) {
            const p = m.multiTouch?.pinch;
            if (!p || !(p.currentSpread > 0) || !(spread > 0)) return;
            const factor = p.currentSpread / spread;
            spread = p.currentSpread;
            const next = viewScreenToWorld(camera.get(), p.centroid);
            const zoomed = zoomedAbout(root.get(), at, factor, clamp);
            root.set({ scale: zoomed.scale, x: zoomed.x + next.x - at.x, y: zoomed.y + next.y - at.y });
            at = next;
          },
          onEnd: () => { pinching.delete(root); },
        };
      },
    },
  };
}

/** The minimap's bindings, each id prefixed with `id`: press to center, drag to pan, and with `zoom` the wheel, a
 *  trackpad pinch (as `viewport.zoom` takes them) and a two-finger touch pinch (as `viewport.pinchZoom` does) to
 *  zoom. `views` scopes them to the minimap's view on a surface that routes several. */
export function minimapBindings(id: string, zoom: boolean, views?: readonly string[]): Tool['bindings'] {
  const scope = views ? { views: [...views] } : {};
  return [
    { spec: { kind: 'pointerDown' }, actionId: MINIMAP_CENTER, opts: { id: `${id}.pointerDown`, ...scope } },
    { spec: { kind: 'drag' }, actionId: MINIMAP_PAN, opts: { id: `${id}.drag`, ...scope } },
    // A trackpad pinch arrives as ctrl+wheel, which a bare-wheel spec rejects, and in Safari as WebKit's pinch.
    ...(zoom ? [
      { spec: { kind: 'wheel' as const }, actionId: MINIMAP_ZOOM, opts: { id: `${id}.wheel`, ...scope } },
      { spec: { kind: 'wheel' as const, mods: { ctrl: true } }, actionId: MINIMAP_ZOOM, opts: { id: `${id}.trackpad`, ...scope } },
      { spec: { kind: 'pinch' as const }, actionId: MINIMAP_ZOOM, opts: { id: `${id}.pinch`, ...scope } },
      { spec: { kind: 'multiTouch' as const, fingers: 2 }, actionId: MINIMAP_PINCH, opts: { id: `${id}.multiTouch`, ...scope } },
    ] : []),
  ];
}
