import { useElementSize, useLatest } from '@weasel-js/core';
import type { LoupeMode } from '@weasel-js/loupe';
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { CameraContext, type CameraContextValue, CameraScope } from '../canvas/CameraInput';
import {
  CanvasStackContext,
  type CanvasStackContextValue,
  type CanvasStackSurface,
} from '../canvas/CanvasStackContext';
import { fromCameraView } from '../canvas/cameraView';
import type { ViewportSize } from '../canvas/worldSpec';
import type { ViewTransform } from '../instrument/types';
import type { Box } from '../surface/rect';
import { useSurfaceOptional } from '../surface/useSurfaceTile';
import { LoupeSwitchContext } from '../trial/loupeSwitch';
import { CanvasLoupe } from './CanvasLoupe';
import { sampleStack } from './canvasLens';
import { DomLoupe } from './DomLoupe';
import { LoupeBubble } from './LoupeBubble';
import { LoupeGestures } from './LoupeGestures';
import { SceneLoupe } from './SceneLoupe';
import { SourceLoupe } from './SourceLoupe';
import { resolveLoupeSource, sampleSource, sourceBoxIn } from './sourceLens';
import { type LoupeLens, type LoupeOptions, type ResolvedLoupe, resolveLoupe } from './types';
import { useLoupe } from './useLoupe';

/** Props for {@link LoupePainter}. */
interface LoupePainterProps<TData, TLayer extends string, TPose> {
  options: ResolvedLoupe<TData, TLayer, TPose>;
  shows: { x: number; y: number };
  shownFactor: number;
  box: { width: number; height: number };
  mode: LoupeMode;
  size: ViewportSize;
  view: ViewTransform | undefined;
  stack: CanvasStackContextValue | null;
  camera: CameraContextValue | null;
  host: RefObject<HTMLElement | null>;
  surface: CanvasStackSurface | undefined;
}

/** Picks and renders the one painter a resolved loupe calls for: `sceneView`'s re-rendered `@weasel-js/core`
 *  scene, `render`'s re-drawn DOM, `source`'s captured pixels, or the ambient `<CanvasStack>`'s own layers. Split
 *  out of `<TrialLoupe>` to keep its own body under `check:size`'s function-length budget. */
function LoupePainter<TData, TLayer extends string, TPose>({
  options,
  shows,
  shownFactor,
  box,
  mode,
  size,
  view,
  stack,
  camera,
  host,
  surface,
}: LoupePainterProps<TData, TLayer, TPose>) {
  if (options.hollow) return null;
  if (options.sceneView) {
    const { scene, view: sceneViewCamera, drawOne, extraCommands, paintBounds } = options.sceneView;
    return (
      <SceneLoupe
        aim={shows}
        factor={shownFactor}
        diameter={box}
        scene={scene}
        view={sceneViewCamera}
        drawOne={drawOne}
        extraCommands={extraCommands}
        paintBounds={paintBounds}
      />
    );
  }
  if (options.render) {
    return (
      <DomLoupe
        aim={shows}
        factor={shownFactor}
        mode={mode}
        diameter={box}
        size={size}
        view={
          view ??
          stack?.view ??
          (camera ? fromCameraView(camera.view.get(), camera.frame) : IDENTITY)
        }
        frame={stack?.frame ?? camera?.frame}
        render={options.render}
      />
    );
  }
  if (options.source) {
    return (
      <SourceLoupe
        aim={shows}
        factor={shownFactor}
        diameter={box}
        source={options.source}
        hostRef={host}
      />
    );
  }
  if (surface && stack) {
    return (
      <CanvasLoupe
        aim={shows}
        factor={shownFactor}
        mode={mode}
        diameter={box}
        surface={surface}
        view={stack.view}
        frame={stack.frame}
        worldSpec={surface.worldSpec}
      />
    );
  }
  return null;
}

/** Props for `<TrialLoupe>`. */
export interface TrialLoupeProps<TData = unknown, TLayer extends string = string, TPose = unknown>
  extends LoupeOptions<TData, TLayer, TPose> {
  /** Whether the lens is turned on. Omitted, it follows the trial's toolbar
   *  toggle, which the trial offers while a lens like this is mounted — and is
   *  off outside a trial. Hold-to-peek shows it either way. */
  enabled?: boolean;
  /** The camera a `render` lens composes its magnification onto. Defaults to
   *  the camera around it, and to the identity outside one. */
  view?: ViewTransform;
  /** The element the lens tracks. Defaults to the canvas stack or stage around
   *  it, and outside both to a box wrapped around `children`. */
  hostRef?: RefObject<HTMLElement | null>;
  /** Content for the lens to sit over. Wrapped in a box of the lens's own only
   *  when nothing around it gives the lens an element to track. */
  children?: ReactNode;
}

const IDENTITY: ViewTransform = { zoom: 1, pan: { x: 0, y: 0 } };

/**
 * A trial's magnifier, mounted by the instrument wherever its content is: in
 * a canvas instrument's `render`, a stage's `overlay`, or around DOM content.
 *
 * With no `render` inside a `<CanvasStack>`, it re-draws the stack's own
 * layers through a zoomed camera. With `render`, it asks for the content again
 * at a magnified camera. With `sceneView`, it re-renders a bare `@weasel-js/core`
 * scene the same way. With `source`, it enlarges the pixels of any canvas.
 */
export function TrialLoupe<TData = unknown, TLayer extends string = string, TPose = unknown>({
  enabled,
  view,
  hostRef,
  children,
  render,
  sceneView,
  source,
  factor,
  minFactor,
  maxFactor,
  mode,
  diameter,
  shape,
  place,
  hollow,
  onLens,
  peekKey,
  onColorChange,
}: TrialLoupeProps<TData, TLayer, TPose>) {
  const stack = useContext(CanvasStackContext);
  const camera = useContext(CameraContext);
  const loupeSwitch = useContext(LoupeSwitchContext);
  const surface = render || sceneView || source || hollow ? undefined : stack?.surface;

  const ownHost = useRef<HTMLDivElement | null>(null);
  const cameraHost = useMemo<RefObject<HTMLElement | null> | null>(
    () =>
      camera
        ? {
            get current() {
              return camera.element();
            },
          }
        : null,
    [camera],
  );
  const host = surface?.element ?? hostRef ?? cameraHost ?? ownHost;
  const wraps = host === ownHost;
  const hostLatest = useLatest(host);

  // A hollow lens is drawn by the host into the tiles under it, so on a shared surface each
  // move dirties the tiles it left and the ones it landed on.
  const tiles = useSurfaceOptional();
  const onLensLatest = useLatest(onLens);
  const was = useRef<Box | null>(null);
  const damage = hollow ? tiles : null;
  const reportLens = useCallback(
    (lens: LoupeLens | null) => {
      onLensLatest.current?.(lens);
      if (!damage) return;
      const at = hostLatest.current.current?.getBoundingClientRect();
      const now =
        lens && at
          ? {
              left: at.left + lens.center.x - lens.width / 2,
              top: at.top + lens.center.y - lens.height / 2,
              width: lens.width,
              height: lens.height,
            }
          : null;
      if (was.current) damage.invalidateBox(was.current);
      if (now) damage.invalidateBox(now);
      was.current = now;
    },
    [damage, onLensLatest, hostLatest],
  );
  const options = useMemo(
    () =>
      resolveLoupe({
        render,
        sceneView,
        source,
        factor,
        minFactor,
        maxFactor,
        mode,
        diameter,
        shape,
        place,
        hollow,
        onLens: onLens || damage ? reportLens : undefined,
        peekKey,
        onColorChange,
      }),
    [
      render,
      sceneView,
      source,
      factor,
      minFactor,
      maxFactor,
      mode,
      diameter,
      shape,
      place,
      hollow,
      onLens,
      damage,
      reportLens,
      peekKey,
      onColorChange,
    ],
  );

  // A lens told whether it is on has no use for the trial's toggle.
  const mount = enabled === undefined ? loupeSwitch?.mount : undefined;
  useEffect(() => mount?.(), [mount]);

  const sample = useMemo(() => {
    if (options.source) {
      const input = options.source;
      return (p: { x: number; y: number }): string | null => {
        const src = resolveLoupeSource(input);
        return src ? sampleSource(src, p, sourceBoxIn(src, host.current)) : null;
      };
    }
    if (!surface) return undefined;
    return (p: { x: number; y: number }): string | null => {
      const canvases = surface.canvases.current;
      return canvases ? sampleStack(surface.layers, canvases, p, surface.size.dpr) : null;
    };
  }, [surface, options.source, host]);

  // Keyed on the resolved source, not the prop: an inline getter is re-made
  // every render, and every aim renders.
  const resolved = resolveLoupeSource(options.source);
  const subscribeResample = useMemo(
    () => (resolved ? (fn: () => void) => resolved.subscribeFrame(fn) : undefined),
    [resolved],
  );

  const loupe = useLoupe({
    options,
    hostRef: host,
    enabled: enabled ?? loupeSwitch?.on ?? false,
    sample,
    subscribeResample,
  });
  // A captured source copies frames only while someone is reading them. Taken
  // after `useLoupe` has subscribed, so the frame a first reader's redraw
  // captures reaches the color too.
  const reading = loupe.visible ? resolved : null;
  useEffect(() => reading?.retain(), [reading]);

  const measured = useElementSize(host);
  const size = surface?.size ?? measured;

  // The gestures mount outside the visibility gate: hold-to-peek is what
  // raises a lens that is down, so its binding has to be live while it is.
  // In a trial they join the trial's scope, and with it the camera's
  // dispatcher; outside one, `<CameraScope>` gives them an isolated scope.
  const gestures = (
    <CameraScope>
      <LoupeGestures hostRef={host} input={loupe.input} peekKey={options.peekKey ?? null} />
    </CameraScope>
  );

  const { center, shows, width, height, factor: shownFactor, shape: lensShape } = loupe.lens;
  const box = { width, height };
  const lens = loupe.visible ? (
    <LoupeBubble aim={center} diameter={box} shape={lensShape} hollow={options.hollow}>
      <LoupePainter
        options={options}
        shows={shows}
        shownFactor={shownFactor}
        box={box}
        mode={loupe.mode}
        size={size}
        view={view}
        stack={stack}
        camera={camera}
        host={host}
        surface={surface}
      />
    </LoupeBubble>
  ) : null;

  if (wraps) {
    return (
      <div ref={ownHost} className="lk-loupe-host">
        {children}
        {gestures}
        {lens}
      </div>
    );
  }
  return (
    <>
      {children}
      {gestures}
      {lens}
    </>
  );
}
