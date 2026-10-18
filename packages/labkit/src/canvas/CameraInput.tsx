/**
 * A labkit camera driven by weasel's dispatcher: drag pans, the wheel zooms
 * about the pointer, a tap reports the world point, and the pointer is
 * published into the store in scope. What `usePanZoom` used to hand-roll.
 */
import {
  type Action,
  type ActionsRegistry,
  contextMenuAction,
  InputScope,
  makePinchZoomAction,
  makeViewportZoomAction,
  PointerContextProvider,
  type PointerWorldPos,
  screenToWorld,
  type Tool,
  useActionsRegistry,
  useDepSource,
  useGestureDispatcher,
  useLatest,
  usePointerContext,
  type View,
  type ViewApi,
  viewportDragPanAction,
  viewToTransform,
  worldToScreen,
  type Yoke,
} from '@weasel-js/core';
import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useInsertionEffect,
  useMemo,
  useRef,
} from 'react';
import type { Point, ViewTransform } from '../instrument/types';
import { LabContextMenusContext } from '../lab/labContextMenus';
import { as2DView, normalize2DView } from '../state/view';
import { useCameraWheelSlot } from './CameraWheelContext';
import { type CameraGestures, resolveGestures } from './cameraGestures';
import { usePublishCamera } from './cameraRegistry';
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

/**
 * The input scope a camera routes through. Inside another camera — a loupe or
 * an overlay laid over a canvas stack — it joins that camera's scope, so its
 * actions reach the dispatcher already listening there. Anywhere else it
 * mounts a scope of its own, which keeps its own tool unless it joins `yoke`:
 * a camera beside another never takes that one's gestures. The pointer store is the exception — one
 * already in scope is kept, since sharing it is the point.
 */
export function CameraScope({ yoke, children }: { yoke?: Yoke; children: ReactNode }) {
  const around = useContext(CameraContext);
  const pointer = usePointerContext();
  if (around) return <>{children}</>;
  const scoped = <InputScope yoke={yoke}>{children}</InputScope>;
  return pointer ? scoped : <PointerContextProvider>{scoped}</PointerContextProvider>;
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

/** A camera's zoom limits, after widening to admit its opening zoom. */
export interface ZoomRange {
  min: number;
  max: number;
}

/** A labkit camera — 2D or an orbit — as a weasel `ViewApi` whose scale is its
 *  zoom, and that also says how far it zooms. */
export interface CameraView extends ViewApi {
  zoomRange(): ZoomRange;
  /** The zoom a trial's stored `view` reads as on this camera, or `null` when
   *  the view is not this camera's shape. Read off the view rather than the
   *  camera, so chrome rendering beside the trial never sees it a change late. */
  zoomOf(view: unknown): number | null;
}

function isPositiveFinite(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/**
 * A labkit camera as a stable `ViewApi`. Its zoom range is widened to keep
 * reachable every zoom it was handed from outside — the opening view, a fit
 * placed once the size is known — and never by its own `set`, so a zoom-out
 * cannot shrink the range and strand such a view behind it.
 */
export function useCameraView({
  view,
  onViewChange,
  frame,
  hostRef,
  minZoom = 0.1,
  maxZoom = 32,
}: CameraViewOptions): CameraView {
  // Written by each commit and by `set`, ahead of the render it asks for —
  // two writers, so not `useLatest`.
  // Written by each commit and by `set`, ahead of the render it asks for —
  // two writers, so not `useLatest`.
  const live = useRef({ view: normalize2DView(view), onViewChange, frame });
  // A view `set` wrote is already in `live`; any other was placed from outside.
  const placedRef = useRef<ZoomRange | null>(null);
  const before = placedRef.current;
  const fromOutside =
    isPositiveFinite(view.zoom) && (before === null || view.zoom !== live.current.view.zoom);
  const placed = fromOutside
    ? {
        min: Math.min(before?.min ?? view.zoom, view.zoom),
        max: Math.max(before?.max ?? view.zoom, view.zoom),
      }
    : before;
  useInsertionEffect(() => {
    placedRef.current = placed;
    live.current = { view: normalize2DView(view), onViewChange, frame };
  });
  const bounds = useLatest({
    min: Math.min(minZoom, placed?.min ?? minZoom),
    max: Math.max(maxZoom, placed?.max ?? maxZoom),
  });

  return useMemo<CameraView>(() => {
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
      zoomRange: () => ({ ...bounds.current }),
      zoomOf: (v) => as2DView(v)?.zoom ?? null,
    };
  }, [bounds, hostRef]);
}

const TAP_ID = 'camera.tap';
const HOME_ID = 'camera.home';
const NO_TOOLS: ReadonlyMap<string, Tool> = new Map();
const CHANNELS = { contextMenu: false, ingest: false } as const;
const CHANNELS_WITH_MENU = { ingest: false } as const;

/** Props for `<CameraInput>`. */
export interface CameraInputProps {
  hostRef: RefObject<HTMLElement | null>;
  /** Published to the host's camera registry while its scope is the active
   *  one, so chrome acting on "the camera" acts on the one last used. */
  camera: CameraView;
  frame: WorldFrame;
  /** A primary-button press released without crossing the drag threshold, at
   *  the world point it landed on. */
  onTap?: (world: Point) => void;
  /** Which gestures the camera takes. Omitted, all but `home`. */
  gestures?: CameraGestures;
  /** Returns the camera to where it opened; what the `home` gesture runs. */
  onHome?: () => void;
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
  onHome,
  gestures,
  registry,
}: CameraInputProps & { registry: ActionsRegistry }) {
  const frameRef = useLatest(frame);
  const onTapRef = useLatest(onTap);
  const onHomeRef = useLatest(onHome);
  const {
    drag,
    wheel,
    trackpadPinch: padPinch,
    touchPinch,
    tap: taps,
    home,
  } = resolveGestures(gestures);
  const homes = home && onHome !== undefined;
  const labMenu = useContext(LabContextMenusContext);

  useDepSource('view', () => camera);
  useDepSource('rootView', () => camera);
  useDepSource('menuHost', () => labMenu ?? undefined);

  const clientToWorld = useMemo(
    () => (cx: number, cy: number) => {
      const r = hostRef.current?.getBoundingClientRect();
      const [x, y] = screenToWorld(
        cx - (r?.left ?? 0),
        cy - (r?.top ?? 0),
        viewToTransform(camera.get()),
      );
      return { x, y };
    },
    [hostRef, camera],
  );
  useDepSource('worldToClient', () => (x: number, y: number) => {
    const r = hostRef.current?.getBoundingClientRect();
    if (!r) return null;
    const [sx, sy] = worldToScreen(x, y, viewToTransform(camera.get()));
    return { x: r.left + sx, y: r.top + sy };
  });

  const actions = useMemo<Action[]>(() => {
    // Unclamped here: `camera.set` clamps, to a range widened around the
    // zooms it was placed at, and anchors the clamp where the wheel was.
    const unclamped = { min: 1e-9, max: Number.POSITIVE_INFINITY };
    const zoom = makeViewportZoomAction({ wheel: wheel || 'plain', ...unclamped });
    // The wheel and the trackpad's two pinch forms (ctrl+wheel, WebKit's
    // gesture events), in that order: the zoom keys listen on the window, and
    // every trial on a page would take them at once.
    const [wheelBinding, ...trackpadPinch] = (
      zoom.defaultBinding as { spec: { kind: string } }[]
    ).filter((b) => b.spec.kind === 'wheel' || b.spec.kind === 'pinch');
    const zoomBindings = [...(wheel ? [wheelBinding] : []), ...(padPinch ? trackpadPinch : [])];
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
    const goHome: Action = {
      id: HOME_ID,
      label: 'Reset view',
      defaultBinding: { kind: 'doubleClick' },
      invoker: { timing: 'immediate', run: () => onHomeRef.current?.() },
    };
    return [
      ...(labMenu ? [contextMenuAction] : []),
      // A trial pans on a plain drag; the kit action binds none of its own.
      ...(drag ? [{ ...viewportDragPanAction, defaultBinding: { kind: 'drag' } } as Action] : []),
      ...(zoomBindings.length > 0
        ? [{ ...zoom, defaultBinding: zoomBindings as Action['defaultBinding'] }]
        : []),
      ...(touchPinch ? [makePinchZoomAction(unclamped)] : []),
      ...(taps ? [tap] : []),
      ...(homes ? [goHome] : []),
    ];
  }, [frameRef, onTapRef, onHomeRef, drag, wheel, padPinch, touchPinch, taps, homes, labMenu]);

  useEffect(() => {
    const offs = actions.map((a) => registry.register(a));
    return () => {
      for (const off of offs) off();
    };
  }, [registry, actions]);

  useGestureDispatcher({
    canvasRef: hostRef,
    actions: registry,
    entriesById: NO_TOOLS,
    clientToWorld,
    channels: labMenu ? CHANNELS_WITH_MENU : CHANNELS,
  });

  usePublishPointer(hostRef, clientToWorld, frame, STAGE_VIEW_ID);
  usePublishCamera(camera);

  // Input that lands outside the camera's element — an annotation target's
  // box, portalled into the surface — reaches the active camera's dispatcher
  // through here.
  useCameraWheelSlot(hostRef, registry);

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
  const frameRef = useLatest(frame);
  const toLocal = useLatest(clientToLocal);
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
  }, [frameRef, hostRef, store, toLocal, viewId]);
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
