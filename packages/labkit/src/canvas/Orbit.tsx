import {
  type Action,
  type ActionsRegistry,
  contextMenuAction,
  type Tool,
  useActionsRegistry,
  useDepSource,
  useGestureDispatcher,
  useLatest,
  type Yoke,
} from '@weasel-js/core';
import {
  type Camera3d,
  type Camera3dDep,
  clampCamera,
  dollyAction,
  homeAction,
  type OrbitLimits,
  orbitAction,
  panAction,
  pinchDollyAction,
} from '@weasel-js/kernel3d';
import { useKitSettings } from '@weasel-js/react';
import {
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LabContextMenusContext } from '../lab/labContextMenus';
import { useSurfaceOptional } from '../surface/useSurfaceTile';
import { CameraScope } from './CameraInput';
import { useCameraWheelSlot } from './CameraWheelContext';
import {
  type CameraGestures,
  type ResolvedCameraGestures,
  resolveGestures,
  touchMode,
} from './cameraGestures';
import { usePublishCamera } from './cameraRegistry';
import { orbitZoomView } from './orbitZoom';
import type { ViewportSize } from './worldSpec';

/** Props for `<Orbit>`. */
export interface OrbitProps {
  view: Camera3d;
  onViewChange: (v: Camera3d) => void;
  /** How far the camera turns and travels. Omitted fields are kernel3d's
   *  `DEFAULT_ORBIT_LIMITS`. */
  limits?: Partial<OrbitLimits>;
  /** Where the camera opened: what the `home` gesture returns it to, and the
   *  distance the zoom chrome reads as 100%. Omitted, the `home` gesture does
   *  nothing and the chrome reads the camera as it stands. */
  home?: () => Camera3d | null;
  /** The element the scene is drawn in, when that is not the camera's whole
   *  element — a pane beside a timeline, say. Gestures land on it, and the
   *  camera measures its pans and anchors its dolly against it, so a renderer
   *  projecting into this pane sees the point under the pointer stay put.
   *  Omitted, the camera's own element. */
  viewport?: HTMLElement | null;
  /** Fired whenever the viewport is measured at a non-zero size. */
  onResize?: (viewport: ViewportSize) => void;
  /** Handed the camera's element. */
  hostRef?: { current: HTMLDivElement | null };
  /** Drawn over the content, after it. */
  overlay?: ReactNode;
  /** The scene: whatever draws through the camera, filling its element. */
  children?: ReactNode;
  /** A yoke to join, from `useYoke()`: cameras on one yoke share their tool
   *  and gesture in flight. Omitted, this one keeps its own. */
  yoke?: Yoke;
  /** Which gestures the camera takes; the rest reach the page. Omitted, all of
   *  them. */
  gestures?: CameraGestures;
}

/**
 * An orbit camera over a 3D scene — what `<Stage>` is for DOM content of a
 * fixed size. A drag turns the camera about its target and Shift+drag pans the
 * target; the wheel and a pinch dolly; a double click goes home. All of it
 * routes through weasel's gesture dispatcher with kernel3d's camera actions,
 * on a `camera3d` dep this element's input scope provides. The camera is plain
 * numbers (`Camera3d`) a renderer projects however it likes.
 */
export function Orbit({
  view,
  onViewChange,
  limits,
  home,
  viewport,
  onResize,
  hostRef,
  overlay,
  children,
  yoke,
  gestures,
}: OrbitProps) {
  const host = useRef<HTMLDivElement | null>(null);
  // The element outlives every render of this component, so it is read once.
  const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => setHostEl(host.current), []);
  const areaEl = viewport ?? hostEl;
  // A new ref object when the viewport changes, which is what rebinds the
  // dispatcher onto it.
  const area = useMemo(() => ({ current: areaEl }), [areaEl]);
  const touch = touchMode(resolveGestures(gestures, { home: true }));
  useEffect(() => {
    if (!areaEl) return;
    areaEl.setAttribute('data-lk-touch', touch);
    return () => areaEl.removeAttribute('data-lk-touch');
  }, [areaEl, touch]);

  const surface = useSurfaceOptional();
  const onResizeRef = useLatest(onResize);
  useEffect(() => {
    const el = areaEl;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        onResizeRef.current?.({ width: rect.width, height: rect.height });
      }
      // A viewport that resized cuts its tiles differently without moving one.
      surface?.invalidateRects();
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [areaEl, onResizeRef, surface]);

  return (
    <CameraScope yoke={yoke}>
      <OrbitInput
        hostRef={area}
        view={view}
        onViewChange={onViewChange}
        limits={limits}
        home={home}
        gestures={gestures}
      />
      <div
        ref={(el) => {
          host.current = el;
          if (hostRef) hostRef.current = el;
        }}
        className="lk-orbit"
      >
        {children}
        {overlay}
      </div>
    </CameraScope>
  );
}

interface OrbitInputProps {
  hostRef: RefObject<HTMLElement | null>;
  view: Camera3d;
  onViewChange: (v: Camera3d) => void;
  limits?: Partial<OrbitLimits>;
  home?: () => Camera3d | null;
  gestures?: CameraGestures;
}

function OrbitInput(props: OrbitInputProps) {
  const registry = useActionsRegistry();
  if (!registry) return null;
  return <OrbitDispatch {...props} registry={registry} />;
}

const NO_TOOLS: ReadonlyMap<string, Tool> = new Map();
const NO_LIMITS: Partial<OrbitLimits> = {};
/** A 3D host's world is its client space; kernel3d's deps cast rays from it. */
const IDENTITY = (x: number, y: number) => ({ x, y });

/** kernel3d's camera actions, bound to the gestures the orbit takes. */
function orbitActions({
  drag,
  wheel,
  trackpadPinch,
  touchPinch,
  homes,
  menu,
}: Omit<ResolvedCameraGestures, 'tap' | 'home'> & { homes: boolean; menu: boolean }): Action[] {
  const wheelSpec =
    wheel === 'plain'
      ? [{ spec: { kind: 'wheel' }, opts: { id: 'camera.dolly.wheel' } }]
      : wheel === 'mod'
        ? [{ spec: { kind: 'wheel', mods: { mod: true } }, opts: { id: 'camera.dolly.modWheel' } }]
        : [];
  // The trackpad's pinch: ctrl+wheel, and WebKit's gesture events.
  const padPinch = trackpadPinch
    ? [
        {
          spec: { kind: 'wheel', mods: { ctrl: true } },
          opts: { id: 'camera.dolly.trackpadPinch' },
        },
        { spec: { kind: 'pinch' }, opts: { id: 'camera.dolly.pinch' } },
      ]
    : [];
  const dollyBindings = [...wheelSpec, ...padPinch];
  return [
    ...(menu ? [contextMenuAction] : []),
    ...(drag
      ? [
          {
            ...orbitAction,
            defaultBinding: [{ spec: { kind: 'drag' }, opts: { id: 'camera.orbit.drag' } }],
          } as Action,
          {
            ...panAction,
            defaultBinding: [
              { spec: { kind: 'drag', mods: { shift: true } }, opts: { id: 'camera.pan.drag' } },
            ],
          } as Action,
        ]
      : []),
    ...(dollyBindings.length > 0
      ? [{ ...dollyAction, defaultBinding: dollyBindings as Action['defaultBinding'] }]
      : []),
    ...(touchPinch ? [pinchDollyAction] : []),
    ...(homes ? [homeAction] : []),
  ];
}

function OrbitDispatch({
  hostRef,
  view,
  onViewChange,
  limits,
  home,
  gestures,
  registry,
}: OrbitInputProps & { registry: ActionsRegistry }) {
  const {
    drag,
    wheel,
    trackpadPinch,
    touchPinch,
    home: homes,
  } = resolveGestures(gestures, {
    home: true,
  });
  const labMenu = useContext(LabContextMenusContext);

  // Written by each commit and by `set`, ahead of the render it asks for — two
  // writers, so not `useLatest`. As `useCameraView`'s.
  const live = useRef({ view, onViewChange, limits, home });
  useInsertionEffect(() => {
    live.current = { view, onViewChange, limits, home };
  });

  const camera3d = useMemo<Camera3dDep>(() => {
    const set = (next: Camera3d): void => {
      const clamped = clampCamera(next, live.current.limits);
      live.current.view = clamped;
      live.current.onViewChange(clamped);
    };
    const hostSize = () => {
      const r = hostRef.current?.getBoundingClientRect();
      return r && r.width > 0 && r.height > 0 ? { width: r.width, height: r.height } : null;
    };
    return {
      get: () => live.current.view,
      set,
      size: () => hostSize() ?? { width: 1, height: 1 },
      limits: () => live.current.limits ?? NO_LIMITS,
      home: () => live.current.home?.() ?? live.current.view,
    };
  }, [hostRef]);
  const zoomView = useMemo(
    () =>
      orbitZoomView({
        get: camera3d.get,
        set: camera3d.set,
        home: () => live.current.home?.() ?? null,
        limits: () => live.current.limits ?? NO_LIMITS,
        hostSize: () => {
          const r = hostRef.current?.getBoundingClientRect();
          return r ? { width: r.width, height: r.height } : null;
        },
      }),
    [camera3d, hostRef],
  );

  const kitSettings = useLatest(useKitSettings());
  useDepSource('camera3d', () => camera3d);
  useDepSource('kitSettings', () => kitSettings.current);
  useDepSource('menuHost', () => labMenu ?? undefined);

  const actions = useMemo(
    () => orbitActions({ drag, wheel, trackpadPinch, touchPinch, homes, menu: labMenu !== null }),
    [drag, wheel, trackpadPinch, touchPinch, homes, labMenu],
  );

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
    clientToWorld: IDENTITY,
    channels: useMemo(
      () => ({
        pointer: drag || homes || touchPinch,
        ingest: false,
        contextMenu: labMenu !== null,
      }),
      [drag, homes, touchPinch, labMenu],
    ),
  });

  usePublishCamera(zoomView);
  useCameraWheelSlot(hostRef, registry);
  return null;
}
