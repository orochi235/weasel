/**
 * `useViewDepSource` — builds a stable `ViewApi` that reads from
 * `currentViewRef`, writes via `onViewChange`, and (when a camera runner is
 * passed) exposes animation.
 *
 * NOTE: this hook does **not** itself call `useDepSource('view', ...)` because
 * `useStandardActions` already publishes the `view` dep when it is passed in
 * its options bag. Returning the `ViewApi` here lets the registrar hand the
 * same instance to `useStandardActions` (which then registers it) without
 * having to reconstruct it inline.
 *
 * Kept as a per-dep module so the construction logic (closure refresh, ref
 * stability, etc.) has a single home next to the other dep modules.
 */
import { useRef } from 'react';
import type React from 'react';
import type { ViewApi } from 'interactions/actions/depSchema';
import type { ViewAnimationApi } from 'core/viewport/useViewAnimation';
import type { View } from 'core/viewport/view';

interface Wiring {
  currentViewRef: React.RefObject<View>;
  onViewChange: (v: View) => void;
  recenter?: () => View | void;
  hostSize?: () => { width: number; height: number } | null;
  animation?: ViewAnimationApi;
}

export function useViewDepSource(
  currentViewRef: React.RefObject<View>,
  onViewChange: (v: View) => void,
  recenter?: () => View | void,
  hostSize?: () => { width: number; height: number } | null,
  animation?: ViewAnimationApi,
): ViewApi {
  // Every method reads through this, so the latest onViewChange / recenter /
  // runner is captured without the API object itself changing identity.
  const wiring = useRef<Wiring>({ currentViewRef, onViewChange, recenter, hostSize, animation });
  wiring.current = { currentViewRef, onViewChange, recenter, hostSize, animation };

  // The optional members must be *absent*, not undefined-valued, when unwired:
  // `viewportZoomAction` branches on `view.recenter` being truthy. So the API
  // is rebuilt only when that presence set changes.
  const shape = `${recenter ? 'r' : ''}${hostSize ? 'h' : ''}${animation ? 'a' : ''}`;
  const shapeRef = useRef<string | null>(null);
  const viewApiRef = useRef<ViewApi | null>(null);

  if (viewApiRef.current === null || shapeRef.current !== shape) {
    shapeRef.current = shape;
    viewApiRef.current = {
      get: () => wiring.current.currentViewRef.current,
      // Not the canvas's only cancel feed (`onViewChange` is), but a `view` dep
      // wired to something other than a `<SceneCanvas>` has only this one.
      set: (v: View) => {
        wiring.current.animation?.stopIfExternal();
        wiring.current.onViewChange(v);
      },
      ...(recenter ? { recenter: () => wiring.current.recenter!() } : {}),
      ...(hostSize ? { hostSize: () => wiring.current.hostSize!() } : {}),
      ...(animation
        ? {
            animate: (to: View, opts?: Parameters<ViewAnimationApi['animate']>[1]) =>
              wiring.current.animation!.animate(to, opts),
            stopAnimation: () => wiring.current.animation!.stop(),
            animationTarget: () => wiring.current.animation!.target(),
          }
        : {}),
    };
  }
  return viewApiRef.current;
}
