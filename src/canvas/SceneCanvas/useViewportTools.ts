/**
 * Viewport-tool wiring for `<SceneCanvas>`. Translates the consumer-facing
 * `viewport` prop into instances of `useHandTool`, `useKeyboardZoomTool`,
 * `useWheelZoomTool`, and `usePinchZoomTool`. Hooks always run (React's rules);
 * each is a no-op when its config slot is absent.
 *
 * Returns `{ handTool, keyZoomTool, wheelZoomTool, viewportRegistered }`. When
 * `viewport` is undefined, `viewportRegistered` is false and SceneCanvas omits
 * `keyZoom`/`wheelZoom` from the ambient tools and `hand` from the registry.
 */
import { type RefObject, useMemo } from 'react';
import { useHandTool } from '../../tools/builtin/useHandTool';
import { useKeyboardZoomTool } from '../../tools/builtin/useKeyboardZoomTool';
import { useWheelZoomTool } from '../../tools/builtin/useWheelZoomTool';
import { usePinchZoomTool } from '../../tools/builtin/usePinchZoomTool';
import type { View } from '../../core/viewport/view';
import type { PanBounds } from '../../core/viewport/useDecayLoop';
import type { AnyTool } from '../../tools/types';

export interface ViewportConfig {
  inertia?:
    | boolean
    | { friction?: number; minSpeed?: number; boundary?: 'stop' | 'bounce'; bounds?: PanBounds };
  pinchZoom?: boolean | { min?: number; max?: number };
  animatedZoom?:
    | boolean
    | { duration?: number; resetDuration?: number; easing?: (t: number) => number };
}

export interface UseViewportToolsArgs {
  viewport: ViewportConfig | undefined;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Latest View — read at pinch dispatch time. The pinch hook keeps its own
   *  derivation; SceneCanvas threads its `currentViewRef.current` here. */
  currentView: View;
  onViewChange: (v: View) => void;
}

export interface UseViewportToolsReturn {
  handTool: AnyTool;
  keyZoomTool: AnyTool;
  wheelZoomTool: AnyTool;
  /** True when the consumer enabled at least one viewport feature. */
  viewportRegistered: boolean;
}

export function useViewportTools(args: UseViewportToolsArgs): UseViewportToolsReturn {
  const { viewport, canvasRef, currentView, onViewChange } = args;

  // Resolve viewport config — `true` means defaults, object means overrides,
  // anything else (undefined / false / null) disables that feature.
  const inertiaEnabled = !!viewport?.inertia;
  const inertiaObj = typeof viewport?.inertia === 'object' ? viewport.inertia : undefined;
  const inertiaFriction = inertiaObj?.friction;
  const inertiaMinSpeed = inertiaObj?.minSpeed;
  const inertiaBoundary = inertiaObj?.boundary;
  const inertiaBounds = inertiaObj?.bounds;
  const inertiaConfig = useMemo<
    false | { friction?: number; minSpeed?: number; boundary?: 'stop' | 'bounce'; bounds?: PanBounds }
  >(
    () =>
      inertiaEnabled
        ? { friction: inertiaFriction, minSpeed: inertiaMinSpeed, boundary: inertiaBoundary, bounds: inertiaBounds }
        : false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inertiaEnabled, inertiaFriction, inertiaMinSpeed, inertiaBoundary, inertiaBounds],
  );

  const pinchConfig: { min?: number; max?: number } | null =
    viewport?.pinchZoom === true ? {} : (viewport?.pinchZoom || null);

  const animatedZoomObj =
    typeof viewport?.animatedZoom === 'object' ? viewport.animatedZoom : undefined;
  const animateEnabled = !!viewport?.animatedZoom;
  const animateDuration = animatedZoomObj?.duration;
  const animateResetDuration = animatedZoomObj?.resetDuration;
  const animateEasing = animatedZoomObj?.easing;

  const handToolInertia =
    inertiaConfig === false
      ? undefined
      : {
          friction: inertiaConfig.friction,
          minSpeed: inertiaConfig.minSpeed,
          boundary: inertiaConfig.boundary,
          bounds: inertiaConfig.bounds,
        };
  const handTool = useHandTool(handToolInertia ? { inertia: handToolInertia } : {});
  const keyZoomTool = useKeyboardZoomTool(
    animateEnabled
      ? { animate: true, duration: animateDuration, resetDuration: animateResetDuration, easing: animateEasing }
      : {},
  );
  // Plain wheel zooms (requireCtrl:false) — covers scroll wheel, Cmd+wheel,
  // and Mac trackpad pinch (browser synthesizes pinch as ctrl+wheel).
  // Touch pinch via pointer events is handled separately by usePinchZoomTool.
  const wheelZoomOpts =
    pinchConfig !== null ? { min: pinchConfig.min, max: pinchConfig.max, requireCtrl: false } : { requireCtrl: false };
  const wheelZoomTool = useWheelZoomTool(viewport ? wheelZoomOpts : {});
  usePinchZoomTool(
    canvasRef,
    currentView,
    onViewChange,
    { ...(pinchConfig ?? {}), enabled: pinchConfig !== null },
  );

  return {
    handTool,
    keyZoomTool,
    wheelZoomTool,
    viewportRegistered: !!viewport,
  };
}
