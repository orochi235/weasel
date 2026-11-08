import { useElementSize, useLatest } from '@weasel-js/core';
import { canvasPixelSource, createSampler, type LoupeMode } from '@weasel-js/loupe';
import { type ReactNode, type RefObject, useContext, useEffect, useMemo, useRef } from 'react';
import { CameraContext, type CameraContextValue, CameraScope } from '../canvas/CameraInput';
import {
  CanvasStackContext,
  type CanvasStackContextValue,
  type CanvasStackSurface,
} from '../canvas/CanvasStackContext';
import { fromCameraView } from '../canvas/cameraView';
import type { ViewportSize } from '../canvas/worldSpec';
import type { ViewTransform } from '../instrument/types';
import { LoupeSwitchContext } from '../trial/loupeSwitch';
import { CanvasLoupe } from './CanvasLoupe';
import { stackSources } from './canvasLens';
import { DomLoupe } from './DomLoupe';
import { LoupeBubble } from './LoupeBubble';
import { LoupeGestures } from './LoupeGestures';
import { SceneLoupe } from './SceneLoupe';
import { SourceLoupe } from './SourceLoupe';
import { resolveLoupeSource, sourceBoxIn } from './sourceLens';
import { type LoupeOptions, type ResolvedLoupe, resolveLoupe } from './types';
import { useLensDamage } from './useLensDamage';
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

/** What a lens reads its color from — the source it was handed, or the stack it sits over — and how it hears that a
 *  captured source has a new frame. */
function useLoupeSampling(
  surface: CanvasStackSurface | undefined,
  input: ReturnType<typeof resolveLoupe>['source'],
  host: RefObject<HTMLElement | null>,
) {
  const sample = useMemo(() => {
    const sampler = input
      ? createSampler(() => {
          const src = resolveLoupeSource(input);
          return src ? [canvasPixelSource(src, () => sourceBoxIn(src, host.current))] : [];
        })
      : surface &&
        createSampler(() => stackSources(surface.layers, surface.canvases.current, surface.size));
    // Every source here is a canvas read at once, so the answer never waits.
    return sampler
      ? (p: { x: number; y: number }) => sampler.sample(p) as string | null
      : undefined;
  }, [surface, input, host]);

  // Keyed on the resolved source, not the prop: an inline getter is re-made
  // every render, and every aim renders.
  const resolved = resolveLoupeSource(input);
  const subscribeResample = useMemo(
    () => (resolved ? (fn: () => void) => resolved.subscribeFrame(fn) : undefined),
    [resolved],
  );
  return { sample, resolved, subscribeResample };
}

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

  const reportLens = useLensDamage(hollow, onLens, hostLatest);
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
        onLens: reportLens,
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
      reportLens,
      peekKey,
      onColorChange,
    ],
  );

  // A lens told whether it is on has no use for the trial's toggle.
  const mount = enabled === undefined ? loupeSwitch?.mount : undefined;
  useEffect(() => mount?.(), [mount]);

  const { sample, resolved, subscribeResample } = useLoupeSampling(surface, options.source, host);

  const loupe = useLoupe({
    options,
    hostRef: host,
    enabled: enabled ?? loupeSwitch?.on ?? false,
    sample,
    subscribeResample,
    dropping: loupeSwitch?.dropper,
    onPick: loupeSwitch?.pick,
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
      <LoupeGestures
        hostRef={host}
        input={loupe.input}
        peekKey={options.peekKey ?? null}
        dropping={loupeSwitch?.dropper}
      />
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
