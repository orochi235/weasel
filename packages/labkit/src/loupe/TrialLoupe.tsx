import { type ReactNode, type RefObject, useContext, useEffect, useMemo, useRef } from 'react';
import { CameraContext, CameraScope } from '../canvas/CameraInput';
import { CanvasStackContext } from '../canvas/CanvasStackContext';
import { fromCameraView } from '../canvas/cameraView';
import type { ViewTransform } from '../instrument/types';
import { LoupeSwitchContext } from '../trial/loupeSwitch';
import { CanvasLoupe } from './CanvasLoupe';
import { sampleStack } from './canvasLens';
import { DomLoupe } from './DomLoupe';
import { LoupeBubble } from './LoupeBubble';
import { LoupeGestures } from './LoupeGestures';
import { SourceLoupe } from './SourceLoupe';
import { resolveLoupeSource, sampleSource, sourceBoxIn } from './sourceLens';
import { type LoupeOptions, resolveLoupe } from './types';
import { useHostSize } from './useHostSize';
import { useLoupe } from './useLoupe';

/** Props for `<TrialLoupe>`. */
export interface TrialLoupeProps extends LoupeOptions {
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
 * at a magnified camera. With `source`, it enlarges the pixels of any canvas.
 */
export function TrialLoupe({
  enabled,
  view,
  hostRef,
  children,
  render,
  source,
  factor,
  minFactor,
  maxFactor,
  mode,
  diameter,
  shape,
  place,
  peekKey,
  onColorChange,
}: TrialLoupeProps) {
  const options = useMemo(
    () =>
      resolveLoupe({
        render,
        source,
        factor,
        minFactor,
        maxFactor,
        mode,
        diameter,
        shape,
        place,
        peekKey,
        onColorChange,
      }),
    [render, source, factor, minFactor, maxFactor, mode, diameter, shape, place, peekKey, onColorChange],
  );

  const stack = useContext(CanvasStackContext);
  const camera = useContext(CameraContext);
  const loupeSwitch = useContext(LoupeSwitchContext);
  const surface = options.render || options.source ? undefined : stack?.surface;

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

  const measured = useHostSize(host);
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
    <LoupeBubble aim={center} diameter={box} shape={lensShape}>
      {options.render ? (
        <DomLoupe
          aim={shows}
          factor={shownFactor}
          mode={loupe.mode}
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
      ) : options.source ? (
        <SourceLoupe
          aim={shows}
          factor={shownFactor}
          diameter={box}
          source={options.source}
          hostRef={host}
        />
      ) : surface && stack ? (
        <CanvasLoupe
          aim={shows}
          factor={shownFactor}
          mode={loupe.mode}
          diameter={box}
          surface={surface}
          view={stack.view}
          frame={stack.frame}
          worldSpec={surface.worldSpec}
        />
      ) : null}
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
