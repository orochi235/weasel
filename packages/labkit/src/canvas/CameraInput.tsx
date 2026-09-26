/**
 * A labkit camera driven by weasel's dispatcher: drag pans, the wheel zooms
 * about the pointer, a tap reports the world point, and the pointer is
 * published into the store in scope. What `usePanZoom` used to hand-roll.
 */
import {
  type Action,
  ActionsProvider,
  type ActionsRegistry,
  ActiveToolContextProvider,
  DepRegistryProvider,
  makeViewportZoomAction,
  PointerContextProvider,
  type PointerWorldPos,
  type Tool,
  useActionsRegistry,
  useDepSource,
  useGestureDispatcher,
  usePointerContext,
  type View,
  type ViewApi,
  viewportDragPanAction,
} from '@weasel-js/core';
import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { Point, ViewTransform } from '../instrument/types';
import { normalize2DView } from '../state/view';
import { CameraWheelContext } from './CameraWheelContext';
import { clampZoomAbout, frameLocalToWorld, fromCameraView, toCameraView } from './cameraView';
import type { ViewportSize, WorldFrame } from './worldSpec';

/** The view id the stage publishes its pointer under. */
export const STAGE_VIEW_ID = 'stage';

/**
 * A camera, as the things that sit beside it read it: an overview, a loupe, a
 * linked cursor. Points are *frame-local* — the world with `y` multiplied by
 * `frame.yDir` — which is the space `view` works in.
 */
export interface CameraContextValue {
  /** The camera as a weasel `ViewApi`, clamped to its zoom range. */
  view: ViewApi;
  frame: WorldFrame;
  /** The element the camera's dispatcher listens on. */
  element: () => HTMLElement | null;
  /** The content's own rect, frame-local, when it has one — a `<Stage>`'s. */
  content?: { x: number; y: number; width: number; height: number };
}

/** The camera around the caller, or `null` outside one. */
export const CameraContext = createContext<CameraContextValue | null>(null);

/** Set by a host that already provides one input scope for everything inside
 *  it — a trial — so the camera, the loupe and an overview share it. */
export const CameraScopeContext = createContext(false);

/**
 * The actions and deps a camera routes through: the ones a trial provides, or
 * an isolated set of its own. Isolated, because an actions registry holds one
 * dispatcher, and a camera must not take input from a canvas beside it. The
 * pointer store is the exception — one already in scope is kept, since sharing
 * it is the point.
 */
export function CameraScope({ children }: { children: ReactNode }) {
  const inScope = useContext(CameraScopeContext);
  const pointer = usePointerContext();
  if (inScope) return <>{children}</>;
  const scoped = <CameraScopeContext.Provider value={true}>{children}</CameraScopeContext.Provider>;
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          {pointer ? scoped : <PointerContextProvider>{scoped}</PointerContextProvider>}
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

/** Options for {@link useCameraView}. */
export interface CameraViewOptions {
  view: ViewTransform;
  onViewChange: (v: ViewTransform) => void;
  frame: WorldFrame;
  hostRef: RefObject<HTMLElement | null>;
  minZoom?: number;
  maxZoom?: number;
}

function isPositiveFinite(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/**
 * A labkit camera as a stable `ViewApi`. Its zoom range is widened to keep the
 * opening zoom reachable — captured once, so a zoom-out cannot shrink the
 * range and strand the opening view behind it.
 */
export function useCameraView({
  view,
  onViewChange,
  frame,
  hostRef,
  minZoom = 0.1,
  maxZoom = 32,
}: CameraViewOptions): ViewApi {
  const live = useRef({ view: normalize2DView(view), onViewChange, frame });
  live.current = { view: normalize2DView(view), onViewChange, frame };
  const initialZoom = useRef(isPositiveFinite(view.zoom) ? view.zoom : null);
  const bounds = useRef({ min: minZoom, max: maxZoom });
  const opening = initialZoom.current;
  bounds.current = {
    min: opening == null ? minZoom : Math.min(minZoom, opening),
    max: opening == null ? maxZoom : Math.max(maxZoom, opening),
  };

  return useMemo<ViewApi>(() => {
    const get = (): View => toCameraView(live.current.view, live.current.frame);
    return {
      get,
      set: (next: View) => {
        const { min, max } = bounds.current;
        const clamped = clampZoomAbout(get(), next, min, max);
        const vt = fromCameraView(clamped, live.current.frame);
        // Written ahead of the render, so a second event inside one commit
        // steps from this one.
        live.current.view = vt;
        live.current.onViewChange(vt);
      },
      hostSize: () => {
        const r = hostRef.current?.getBoundingClientRect();
        return r ? { width: r.width, height: r.height } : null;
      },
    };
  }, [hostRef]);
}

const TAP_ID = 'camera.tap';
const NO_TOOLS: ReadonlyMap<string, Tool> = new Map();
const CHANNELS = { contextMenu: false, ingest: false } as const;

/** Props for `<CameraInput>`. */
export interface CameraInputProps {
  hostRef: RefObject<HTMLElement | null>;
  camera: ViewApi;
  frame: WorldFrame;
  /** A primary-button press released without crossing the drag threshold, at
   *  the world point it landed on. */
  onTap?: (world: Point) => void;
}

/**
 * Mounts the dispatcher on `hostRef` and routes the camera's gestures through
 * it. Render it inside a `<CameraScope>`; with no actions registry in scope it
 * renders nothing.
 */
export function CameraInput(props: CameraInputProps) {
  const registry = useActionsRegistry();
  if (!registry) return null;
  return <CameraDispatch {...props} registry={registry} />;
}

function CameraDispatch({
  hostRef,
  camera,
  frame,
  onTap,
  registry,
}: CameraInputProps & { registry: ActionsRegistry }) {
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  useDepSource('view', () => camera);
  useDepSource('rootView', () => camera);

  const actions = useMemo<Action[]>(() => {
    // Unclamped here: `camera.set` clamps, to a range widened around the
    // opening zoom, and anchors the clamp where the wheel was.
    const zoom = makeViewportZoomAction({
      wheel: 'plain',
      min: 1e-9,
      max: Number.POSITIVE_INFINITY,
    });
    // The wheel and the trackpad's two pinch forms only: the zoom keys listen
    // on the window, and every trial on a page would take them at once.
    const wheelOnly = (zoom.defaultBinding as { spec: { kind: string } }[]).filter(
      (b) => b.spec.kind === 'wheel' || b.spec.kind === 'pinch',
    );
    const tap: Action = {
      id: TAP_ID,
      label: 'Tap the canvas',
      defaultBinding: { kind: 'click' },
      invoker: {
        timing: 'immediate',
        run: (_deps, params) => {
          const p = params as { worldX?: number; worldY?: number } | undefined;
          if (p?.worldX === undefined || p.worldY === undefined) return;
          onTapRef.current?.(frameLocalToWorld({ x: p.worldX, y: p.worldY }, frameRef.current));
        },
      },
    };
    return [
      viewportDragPanAction,
      { ...zoom, defaultBinding: wheelOnly as Action['defaultBinding'] },
      tap,
    ];
  }, []);

  useEffect(() => {
    const offs = actions.map((a) => registry.register(a));
    return () => {
      for (const off of offs) off();
    };
  }, [registry, actions]);

  const clientToWorld = useMemo(
    () => (cx: number, cy: number) => {
      const r = hostRef.current?.getBoundingClientRect();
      const v = camera.get();
      return {
        x: (cx - (r?.left ?? 0)) / v.scale.x + v.x,
        y: (cy - (r?.top ?? 0)) / v.scale.y + v.y,
      };
    },
    [hostRef, camera],
  );

  useGestureDispatcher({
    canvasRef: hostRef,
    actions: registry,
    toolsById: NO_TOOLS,
    clientToWorld,
    channels: CHANNELS,
  });

  usePublishPointer(hostRef, clientToWorld, frame, STAGE_VIEW_ID);

  // Input that lands outside the camera's element — an annotation target's
  // box, portalled into the surface — reaches the dispatcher through here.
  const wheelSlot = useContext(CameraWheelContext);
  useEffect(() => {
    if (!wheelSlot) return;
    const forward = (e: WheelEvent): void => {
      hostRef.current?.dispatchEvent(new WheelEvent('wheel', e));
    };
    wheelSlot.current = forward;
    return () => {
      if (wheelSlot.current === forward) wheelSlot.current = null;
    };
  }, [wheelSlot, hostRef]);

  return null;
}

/**
 * Publish the pointer over `hostRef` into the store in scope, in the
 * instrument's world, as `viewId`; clear it when the pointer leaves with no
 * button held.
 */
export function usePublishPointer(
  hostRef: RefObject<HTMLElement | null>,
  clientToLocal: (cx: number, cy: number) => Point,
  frame: WorldFrame,
  viewId: string,
): void {
  const store = usePointerContext();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const toLocal = useRef(clientToLocal);
  toLocal.current = clientToLocal;
  useEffect(() => {
    const el = hostRef.current;
    if (!el || !store) return;
    const onMove = (e: PointerEvent): void => {
      const w = frameLocalToWorld(toLocal.current(e.clientX, e.clientY), frameRef.current);
      store.set({ worldX: w.x, worldY: w.y, viewId });
    };
    const onLeave = (e: PointerEvent): void => {
      if (e.buttons !== 0) return;
      if (store.get()?.viewId === viewId) store.set(null);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [hostRef, store, viewId]);
}

/** The pointer as a frame-local point, or `null` when there is none or it is
 *  over `viewId` itself. */
export function pointerElsewhere(
  p: PointerWorldPos,
  viewId: string,
  frame: WorldFrame,
): Point | null {
  if (!p || p.viewId === viewId) return null;
  return frameLocalToWorld({ x: p.worldX, y: p.worldY }, frame);
}

export type { ViewportSize };
