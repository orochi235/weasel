/**
 * The minimap's input: press to recenter the main camera on a world point,
 * drag to keep it there. Both read `rootView` — never `view`, which inside the
 * minimap's own view answers the minimap's camera.
 */
import type { Action, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { ViewApi } from 'interactions/actions/depSchema';

export const MINIMAP_CENTER = 'minimap.center';
export const MINIMAP_PAN = 'minimap.pan';

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
  return deps.rootView as ViewApi | undefined;
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
        const p = params as { worldX?: number; worldY?: number } | undefined;
        const root = rootOf(deps);
        if (!root || p?.worldX === undefined || p.worldY === undefined) return;
        centerRootOn(root, p.worldX, p.worldY);
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
