import { useCallback, useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import { useActionsRegistry, useDepSource, useGestureDispatcher } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { Tool } from '@weasel-js/routing';
import { clientToCanvas, viewScreenToWorld, type View, type ViewApi, type ZoomClampOptions } from '@weasel-js/core';
import { minimapBindings, minimapCenterAction, minimapPanAction, minimapPinchAction, minimapZoomAction } from './actions';

// Unscoped: this dispatcher routes no views, so every input on it is the minimap's.
const toolsById = (zoom: boolean): ReadonlyMap<string, Tool> =>
  new Map([['minimap', { id: 'minimap', eligibility: { always: true }, bindings: minimapBindings('minimap', zoom) }]]);
const PAN_TOOLS = toolsById(false);
const PAN_ZOOM_TOOLS = toolsById(true);
const PAN_CHANNELS = { wheel: false, pinch: false, contextMenu: false, ingest: false } as const;
const PAN_ZOOM_CHANNELS = { ...PAN_CHANNELS, wheel: true, pinch: true } as const;

/** What `useMinimapInput` reads. */
export interface MinimapInputOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  mainView: View;
  mainViewDims: { width: number; height: number };
  onMainViewChange: (next: View) => void;
  /** The minimap's own camera, through which a client point becomes a world one. */
  fitView: View;
  /** The minimap's CSS-pixel size, its camera's host. */
  size: { width: number; height: number };
  zoom: boolean | ZoomClampOptions;
}

/** Wire `<MinimapCanvas>`'s dispatcher: its actions, bound unscoped, moving the
 *  main camera through `rootView`. The minimap's own camera is its `view`, as a
 *  `<CanvasView>`'s is on a surface, so the same actions run in either host.
 *  Returns the client → world map it routes by. */
export function useMinimapInput(opts: MinimapInputOptions): (cx: number, cy: number) => { x: number; y: number } {
  const { canvasRef, zoom } = opts;
  const mainViewRef = useLatest(opts.mainView);
  const mainViewDimsRef = useLatest(opts.mainViewDims);
  const onMainViewChangeRef = useLatest(opts.onMainViewChange);
  const fitViewRef = useLatest(opts.fitView);
  const sizeRef = useLatest(opts.size);

  // The main canvas's camera, which is what the minimap's actions move.
  const rootView = useMemo<ViewApi>(() => ({
    get: () => mainViewRef.current,
    set: (v) => onMainViewChangeRef.current(v),
    hostSize: () => mainViewDimsRef.current,
  }), [mainViewRef, onMainViewChangeRef, mainViewDimsRef]);
  useDepSource('rootView', () => rootView);

  // The minimap's camera follows the scene, so a write to it is dropped, as one to a derived `<CanvasView>` camera is.
  const camera = useMemo<ViewApi>(() => ({
    get: () => fitViewRef.current,
    set: () => {},
    hostSize: () => sizeRef.current,
  }), [fitViewRef, sizeRef]);
  useDepSource('view', () => camera);

  const actions = useActionsRegistry();
  useEffect(() => {
    if (!actions) return;
    const off = [actions.register(minimapCenterAction()), actions.register(minimapPanAction())];
    return () => { for (const u of off) u(); };
  }, [actions]);

  const zoomOn = zoom !== false;
  const zoomRef = useLatest(zoom);
  useEffect(() => {
    if (!actions || !zoomOn) return;
    const clamp = () => {
      const z = zoomRef.current;
      return typeof z === 'object' ? z : undefined;
    };
    const off = [actions.register(minimapZoomAction(clamp)), actions.register(minimapPinchAction(clamp))];
    return () => { for (const u of off) u(); };
  }, [actions, zoomOn, zoomRef]);

  /** Client point → world, through the fit camera. */
  const clientToWorld = useCallback((cx: number, cy: number) => {
    const canvas = canvasRef.current;
    const [x, y] = canvas ? clientToCanvas(canvas, cx, cy) : [cx, cy];
    return viewScreenToWorld(fitViewRef.current, { x, y });
  }, [canvasRef, fitViewRef]);

  useGestureDispatcher({
    canvasRef: canvasRef,
    actions: actions!,
    entriesById: zoomOn ? PAN_ZOOM_TOOLS : PAN_TOOLS,
    clientToWorld,
    keyboard: false,
    channels: zoomOn ? PAN_ZOOM_CHANNELS : PAN_CHANNELS,
  });

  return clientToWorld;
}
