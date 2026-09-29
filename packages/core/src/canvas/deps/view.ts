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
import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type React from 'react';
import type { ViewApi } from 'interactions/actions/depSchema';
import type { ViewAnimationApi } from 'core/viewport/useViewAnimation';
import type { DecayLoopConfig } from 'core/viewport/useDecayLoop';
import type { View } from 'core/viewport/view';

interface Wiring {
  currentViewRef: React.RefObject<View>;
  onViewChange: (v: View) => void;
  recenter?: () => View | void;
  hostSize?: () => { width: number; height: number } | null;
  animation?: ViewAnimationApi;
  decay?: DecayApi;
  layerIsPainted?: (layerId: string) => boolean;
}

/** The slice of `useDecayLoop` the view dep republishes. */
export interface DecayApi {
  start(config: DecayLoopConfig): void;
  cancel(): void;
}

export function useViewDepSource(
  currentViewRef: React.RefObject<View>,
  onViewChange: (v: View) => void,
  recenter?: () => View | void,
  hostSize?: () => { width: number; height: number } | null,
  animation?: ViewAnimationApi,
  decay?: DecayApi,
  layerIsPainted?: (layerId: string) => boolean,
): ViewApi {
  // Every method reads through this, so the latest onViewChange / recenter /
  // runner is captured without the API object itself changing identity.
  const wiring = useLatest<Wiring>({
    currentViewRef, onViewChange, recenter, hostSize, animation, decay, layerIsPainted,
  });

  // An unwired optional member must read falsy — `viewportZoomAction` branches
  // on `view.recenter`, and a forwarder is truthy — so the identity-stable API
  // is rebuilt whenever that presence set changes.
  const hasRecenter = !!recenter;
  const hasHostSize = !!hostSize;
  const hasAnimation = !!animation;
  const hasDecay = !!decay;
  const hasLayerIsPainted = !!layerIsPainted;
  return useMemo((): ViewApi => ({
    get: () => wiring.current.currentViewRef.current,
    // Not the canvas's only cancel feed (`onViewChange` is), but a `view` dep
    // wired to something other than a `<SceneCanvas>` has only this one.
    set: (v: View) => {
      wiring.current.animation?.stopIfExternal();
      wiring.current.onViewChange(v);
    },
    ...(hasRecenter ? { recenter: () => wiring.current.recenter!() } : {}),
    ...(hasHostSize ? { hostSize: () => wiring.current.hostSize!() } : {}),
    ...(hasAnimation
      ? {
          animate: (to: View, opts?: Parameters<ViewAnimationApi['animate']>[1]) =>
            wiring.current.animation!.animate(to, opts),
          stopAnimation: () => wiring.current.animation!.stop(),
          animationTarget: () => wiring.current.animation!.target(),
        }
      : {}),
    ...(hasDecay
      ? {
          decay: (config: DecayLoopConfig) => wiring.current.decay!.start(config),
          stopDecay: () => wiring.current.decay!.cancel(),
        }
      : {}),
    ...(hasLayerIsPainted
      ? { layerIsPainted: (layerId: string) => wiring.current.layerIsPainted!(layerId) }
      : {}),
  }), [wiring, hasRecenter, hasHostSize, hasAnimation, hasDecay, hasLayerIsPainted]);
}
