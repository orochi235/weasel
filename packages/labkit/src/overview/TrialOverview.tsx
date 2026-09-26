/**
 * `<TrialOverview>` — the whole of a trial's content at a glance, in a panel
 * that floats over the stage: the visible rect, a crosshair where the pointer
 * is on the stage, and a press or drag that moves the stage's camera there.
 *
 * It is the labkit form of core's minimap contribution: the same
 * `minimap.center` / `minimap.pan` actions, run on a dispatcher of its own with
 * the trial's camera as `rootView`, and the same crosshair geometry.
 */
import {
  ActionsProvider,
  ActiveToolContextProvider,
  crosshairRects,
  DepRegistryProvider,
  MINIMAP_CENTER,
  MINIMAP_PAN,
  minimapCenterAction,
  minimapPanAction,
  type Tool,
  useActionsRegistry,
  useDepSource,
  useGestureDispatcher,
  usePointerPosition,
  type View,
  type ViewApi,
} from '@weasel-js/core';
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  CameraContext,
  type CameraContextValue,
  pointerElsewhere,
  usePublishPointer,
} from '../canvas/CameraInput';
import { CanvasStackContext } from '../canvas/CanvasStackContext';
import { fromCameraView } from '../canvas/cameraView';
import type { ViewportSize, WorldFrame } from '../canvas/worldSpec';
import { FloatingPanel, type FloatingPanelProps } from '../primitives/FloatingPanel';
import { OverviewMarks } from './OverviewMarks';

/** The view id the overview publishes its pointer under. */
export const OVERVIEW_VIEW_ID = 'overview';

/** A rect in the instrument's world. */
export interface OverviewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What an overview's `render` is handed. */
export interface OverviewRenderArgs {
  /** The content's own size in CSS pixels, at zoom 1 — lay out at this size
   *  and the overview scales it to fit. */
  size: ViewportSize;
}

/** Props for `<TrialOverview>`. */
export interface TrialOverviewProps {
  /** The overview box, in CSS pixels. */
  width: number;
  height: number;
  /**
   * DOM content for the overview, laid out at the content's own size — for a
   * `stage` instrument, typically a lighter copy of what its `render` draws.
   * Never the instrument's own `render`: its effects would run twice. A canvas
   * instrument omits it, and the overview redraws the canvas's layers.
   */
  render?: (args: OverviewRenderArgs) => ReactNode;
  /** What to frame, in the instrument's world. Defaults to a stage's content
   *  rect; a canvas instrument, whose world has no edge, names one. */
  bounds?: OverviewBounds;
  /** Panel title. */
  title?: string;
  anchor?: FloatingPanelProps['anchor'];
  persist?: string;
  className?: string;
}

const PADDING = 6;
const OVERVIEW_INPUT: Tool = {
  id: 'overview',
  eligibility: { always: true },
  bindings: [
    { spec: { kind: 'pointerDown' }, actionId: MINIMAP_CENTER },
    { spec: { kind: 'drag' }, actionId: MINIMAP_PAN },
  ],
};
const TOOLS_BY_ID: ReadonlyMap<string, Tool> = new Map([[OVERVIEW_INPUT.id, OVERVIEW_INPUT]]);
const CHANNELS = { wheel: false, pinch: false, contextMenu: false, ingest: false } as const;

/** A world rect as a frame-local one. */
function toLocalRect(b: OverviewBounds, frame: WorldFrame): OverviewBounds {
  if (frame.yDir === 1) return b;
  return { x: b.x, y: -(b.y + b.height), width: b.width, height: b.height };
}

/** The camera that fits `rect` into `size`, `PADDING` in from every edge. */
function fitRect(rect: OverviewBounds, size: ViewportSize): View {
  const s = Math.min(
    Math.max(1, size.width - 2 * PADDING) / Math.max(rect.width, 1e-9),
    Math.max(1, size.height - 2 * PADDING) / Math.max(rect.height, 1e-9),
  );
  return {
    x: rect.x + rect.width / 2 - size.width / (2 * s),
    y: rect.y + rect.height / 2 - size.height / (2 * s),
    scale: { x: s, y: s },
  };
}

/** A canvas's 2D context sized to `size` at the device pixel ratio. */
function prepare(
  canvas: HTMLCanvasElement | null,
  size: ViewportSize,
): CanvasRenderingContext2D | null {
  const ctx = canvas?.getContext('2d') ?? null;
  if (!canvas || !ctx) return null;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(size.width * dpr);
  const h = Math.round(size.height * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size.width, size.height);
  return ctx;
}

function cssVar(el: Element | null, name: string, fallback: string): string {
  if (!el) return fallback;
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/**
 * A trial's overview. Mount it from an instrument's `render` (a canvas
 * instrument) or `stage.overlay` (a DOM stage) — anywhere inside the trial's
 * camera.
 */
export function TrialOverview(props: TrialOverviewProps) {
  const camera = useContext(CameraContext);
  if (!camera) return null;
  return <Overview {...props} camera={camera} />;
}

function Overview({
  width,
  height,
  render,
  bounds,
  title = 'Overview',
  anchor = 'bottom-left',
  persist,
  className,
  camera,
}: TrialOverviewProps & { camera: CameraContextValue }) {
  const size = useMemo(() => ({ width, height }), [width, height]);
  const content = bounds ? toLocalRect(bounds, camera.frame) : camera.content;
  // `content` is rebuilt every render, so the fit keys on its numbers.
  const framed = content !== null && content !== undefined;
  const { x = 0, y = 0, width: w = 0, height: h = 0 } = content ?? {};
  const fit = useMemo(
    () =>
      framed ? fitRect({ x, y, width: w, height: h }, size) : { x: 0, y: 0, scale: { x: 1, y: 1 } },
    [framed, x, y, w, h, size],
  );
  const boxRef = useRef<HTMLDivElement | null>(null);

  return (
    <FloatingPanel
      anchor={anchor}
      className={className ? `lk-overview ${className}` : 'lk-overview'}
      {...(persist ? { persist } : {})}
    >
      <div className="lk-overview__title">{title}</div>
      <div ref={boxRef} className="lk-overview__box" data-no-drag style={boxVars(size)}>
        {render && content ? (
          <div className="lk-overview__content" style={contentVars(fit, content)}>
            {render({ size: { width: content.width, height: content.height } })}
          </div>
        ) : null}
        {render ? null : <LayersCanvas fit={fit} size={size} frame={camera.frame} />}
        <OverviewMarks fit={fit} camera={camera} />
        <ChromeCanvas fit={fit} size={size} camera={camera} />
        <OverviewInput boxRef={boxRef} fit={fit} camera={camera} />
      </div>
    </FloatingPanel>
  );
}

// The box's size and the content's camera change with props, and a transform
// has nowhere to live but the element's own style: set as custom properties
// the stylesheet reads, as `<Stage>` does.
function boxVars(size: ViewportSize): CSSProperties {
  return {
    ['--lk-overview-w' as string]: `${size.width}px`,
    ['--lk-overview-h' as string]: `${size.height}px`,
  } as CSSProperties;
}

function contentVars(fit: View, content: OverviewBounds): CSSProperties {
  const s = fit.scale.x;
  return {
    ['--lk-overview-x' as string]: `${(content.x - fit.x) * s}px`,
    ['--lk-overview-y' as string]: `${(content.y - fit.y) * s}px`,
    ['--lk-overview-zoom' as string]: String(s),
    ['--lk-overview-cw' as string]: `${content.width}px`,
    ['--lk-overview-ch' as string]: `${content.height}px`,
  } as CSSProperties;
}

/** A canvas instrument's layers, redrawn through the fit camera. */
function LayersCanvas({ fit, size, frame }: { fit: View; size: ViewportSize; frame: WorldFrame }) {
  const stack = useContext(CanvasStackContext);
  const ref = useRef<HTMLCanvasElement | null>(null);
  const layers = stack?.surface?.layers;
  useLayoutEffect(() => {
    const ctx = prepare(ref.current, size);
    if (!ctx || !layers) return;
    const local: WorldFrame = { originPx: { x: 0, y: 0 }, yDir: frame.yDir };
    const view = fromCameraView(fit, local);
    for (const layer of layers) {
      if (!layer.visible || layer.id.startsWith('__lk_')) continue;
      ctx.save();
      layer.render(ctx, view, local);
      ctx.restore();
    }
  }, [layers, fit, size, frame.yDir]);
  return <canvas ref={ref} className="lk-overview__canvas" />;
}

/** The visible-rect indicator and the linked crosshair. */
function ChromeCanvas({
  fit,
  size,
  camera,
}: {
  fit: View;
  size: ViewportSize;
  camera: CameraContextValue;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const pointer = usePointerPosition();
  const root = camera.view.get();
  const host = camera.view.hostSize?.() ?? null;
  // No dependency list: this renders only when the pointer or the trial's
  // camera moved, and either one moves the chrome.
  useLayoutEffect(() => {
    const ctx = prepare(ref.current, size);
    if (!ctx) return;
    const s = fit.scale.x;
    const px = (x: number, y: number) => ({ x: (x - fit.x) * s, y: (y - fit.y) * s });
    if (host) {
      const a = px(root.x, root.y);
      ctx.strokeStyle = cssVar(ref.current, '--wzl-fg', '#ffffff');
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.strokeRect(
        a.x + 0.5,
        a.y + 0.5,
        (host.width / root.scale.x) * s,
        (host.height / root.scale.y) * s,
      );
      ctx.setLineDash([]);
    }
    const world = pointerElsewhere(pointer, OVERVIEW_VIEW_ID, camera.frame);
    if (world) {
      // Back to frame-local: the map is its own inverse.
      const at = px(world.x, world.y * camera.frame.yDir);
      const { halo, bars } = crosshairRects(at.x, at.y, 1);
      ctx.fillStyle = 'rgb(0 0 0 / 60%)';
      for (const r of halo) ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = cssVar(ref.current, '--wzl-accent', '#4c8dff');
      for (const r of bars) ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  });
  return <canvas ref={ref} className="lk-overview__canvas lk-overview__chrome" />;
}

/**
 * The overview's input, on a dispatcher of its own: its actions and deps are
 * isolated from the trial's, its pointer store is shared with it.
 */
function OverviewInput(props: {
  boxRef: RefObject<HTMLDivElement | null>;
  fit: View;
  camera: CameraContextValue;
}) {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <OverviewDispatch {...props} />
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

function OverviewDispatch({
  boxRef,
  fit,
  camera,
}: {
  boxRef: RefObject<HTMLDivElement | null>;
  fit: View;
  camera: CameraContextValue;
}) {
  const registry = useActionsRegistry();
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const root = camera.view;
  useDepSource('rootView', () => root as ViewApi);

  useEffect(() => {
    if (!registry) return;
    const offs = [registry.register(minimapCenterAction()), registry.register(minimapPanAction())];
    return () => {
      for (const off of offs) off();
    };
  }, [registry]);

  const clientToLocal = useMemo(
    () => (cx: number, cy: number) => {
      const r = boxRef.current?.getBoundingClientRect();
      const f = fitRef.current;
      return {
        x: (cx - (r?.left ?? 0)) / f.scale.x + f.x,
        y: (cy - (r?.top ?? 0)) / f.scale.y + f.y,
      };
    },
    [boxRef],
  );

  useGestureDispatcher({
    canvasRef: boxRef,
    // Always present: `OverviewInput` mounts the provider directly above.
    actions: registry as NonNullable<typeof registry>,
    toolsById: TOOLS_BY_ID,
    clientToWorld: clientToLocal,
    keyboard: false,
    channels: CHANNELS,
  });

  usePublishPointer(boxRef, clientToLocal, camera.frame, OVERVIEW_VIEW_ID);

  // The box sits inside the stage's element, whose own dispatcher, loupe and
  // pointer publisher would otherwise take every event that bubbles out of it.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const stop = (e: Event): void => e.stopPropagation();
    const kinds = [
      'pointerdown',
      'pointermove',
      'pointerup',
      'click',
      'wheel',
      'dblclick',
      'contextmenu',
    ];
    for (const k of kinds) el.addEventListener(k, stop);
    return () => {
      for (const k of kinds) el.removeEventListener(k, stop);
    };
  }, [boxRef]);

  return null;
}
