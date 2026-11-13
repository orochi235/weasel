import { useCallback, useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import { useActionsRegistry, useDepSource, useGestureDispatcher } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { Tool } from '@weasel-js/routing';
import { clientToCanvas, viewScreenToWorld, type View, type ViewApi, type ZoomClampOptions } from '@weasel-js/core';
import { minimapBindings, minimapCenterAction, minimapPanAction, minimapZoomAction } from './actions';

// Unscoped: this dispatcher routes no views, so every input on it is the minimap's.
const toolsById = (wheel: boolean): ReadonlyMap<string, Tool> =>
  new Map([['minimap', { id: 'minimap', eligibility: { always: true }, bindings: minimapBindings('minimap', wheel) }]]);
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
  wheelZoom: boolean | ZoomClampOptions;
}

/** Wire `<MinimapCanvas>`'s dispatcher: its actions, bound unscoped, moving the
 *  main camera through `rootView`. Returns the client → world map it routes by. */
export function useMinimapInput(opts: MinimapInputOptions): (cx: number, cy: number) => { x: number; y: number } {
  const { canvasRef, wheelZoom } = opts;
  const mainViewRef = useLatest(opts.mainView);
  const mainViewDimsRef = useLatest(opts.mainViewDims);
  const onMainViewChangeRef = useLatest(opts.onMainViewChange);
  const fitViewRef = useLatest(opts.fitView);

  // The main canvas's camera, which is what the minimap's actions move.
  const rootView = useMemo<ViewApi>(() => ({
    get: () => mainViewRef.current,
    set: (v) => onMainViewChangeRef.current(v),
    hostSize: () => mainViewDimsRef.current,
  }), [mainViewRef, onMainViewChangeRef, mainViewDimsRef]);
  useDepSource('rootView', () => rootView);

  const actions = useActionsRegistry();
  useEffect(() => {
    if (!actions) return;
    const off = [actions.register(minimapCenterAction()), actions.register(minimapPanAction())];
    return () => { for (const u of off) u(); };
  }, [actions]);

  const zoomOn = wheelZoom !== false;
  const wheelZoomRef = useLatest(wheelZoom);
  useEffect(() => {
    if (!actions || !zoomOn) return;
    return actions.register(minimapZoomAction(() => {
      const z = wheelZoomRef.current;
      return typeof z === 'object' ? z : undefined;
    }));
  }, [actions, zoomOn, wheelZoomRef]);

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
