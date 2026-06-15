/**
 * Viewport-tool wiring for `<SceneCanvas>`. Translates the consumer-facing
 * `viewport` prop into a `useHandTool` instance and wires `usePinchZoomTool`.
 * Hooks always run (React's rules); each is a no-op when its config is absent.
 *
 * Keyboard zoom (Cmd+=/-/0) and wheel zoom/pan are now handled by the
 * `viewport.zoom` and `viewport.pan` action descriptors registered via
 * `useStandardActions` + `useGestureDispatcher`. The former
 * `useKeyboardZoomTool` and `useWheelZoomTool` ambient tools are dissolved.
 *
 * Returns `{ handTool, viewportRegistered }`. When `viewport` is undefined,
 * `viewportRegistered` is false and SceneCanvas omits `hand` from the registry.
 */
import { type RefObject, useMemo } from 'react';
import { useHandTool } from 'tools/builtin/hand';
import { usePinchZoomTool } from 'tools/builtin/pinchZoom';
import type { View } from 'core/viewport/view';
import type { PanBounds } from 'core/viewport/useDecayLoop';
import type { AnyTool } from 'tools/types';

export interface ViewportConfig {
  inertia?:
    | boolean
    | { friction?: number; minSpeed?: number; boundary?: 'stop' | 'bounce' | 'spring'; bounds?: PanBounds };
  pinchZoom?: boolean | { min?: number; max?: number };
  /** Wheel pan (plain wheel → pan). Default: `true`. Set `false` to disable. */
  pan?: boolean;
  /** Wheel + keyboard zoom (Cmd+wheel, Cmd+=/-/0). Default: `true`. Set `false` to disable. */
  zoom?: boolean;
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
    false | { friction?: number; minSpeed?: number; boundary?: 'stop' | 'bounce' | 'spring'; bounds?: PanBounds }
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

  usePinchZoomTool(
    canvasRef,
    currentView,
    onViewChange,
    { ...(pinchConfig ?? {}), enabled: pinchConfig !== null },
  );

  return {
    handTool,
    viewportRegistered: !!viewport,
  };
}
