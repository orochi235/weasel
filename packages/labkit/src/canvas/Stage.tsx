import { type CSSProperties, type ReactNode, useContext, useEffect, useRef } from 'react';
import type { ViewTransform } from '../instrument/types';
import { useSurfaceOptional } from '../surface/useSurfaceTile';
import { CameraWheelContext } from './CameraWheelContext';
import { usePanZoom } from './usePanZoom';
import type { ViewportSize } from './worldSpec';

/** Props for `<Stage>`. */
export interface StageProps {
  /** The content's own size in CSS pixels, at zoom 1. */
  size: ViewportSize;
  view: ViewTransform;
  onViewChange: (v: ViewTransform) => void;
  minZoom?: number;
  maxZoom?: number;
  /** Fired whenever the stage's viewport is measured at a non-zero size. */
  onResize?: (viewport: ViewportSize) => void;
  /** Handed the viewport element, for a consumer tracking the pointer over it. */
  hostRef?: { current: HTMLDivElement | null };
  /** Drawn over the content in viewport pixels, outside the camera. */
  overlay?: ReactNode;
  children?: ReactNode;
}

/**
 * The camera a stage opens at: the content centered in its viewport, shrunk to
 * fit if it has to be and never enlarged past its own size.
 */
export function fitStage(size: ViewportSize, viewport: ViewportSize): ViewTransform {
  if (!(size.width > 0 && size.height > 0 && viewport.width > 0 && viewport.height > 0)) {
    return { zoom: 1, pan: { x: 0, y: 0 } };
  }
  const zoom = Math.min(1, viewport.width / size.width, viewport.height / size.height);
  return {
    zoom,
    pan: {
      x: (viewport.width - size.width * zoom) / 2,
      y: (viewport.height - size.height * zoom) / 2,
    },
  };
}

/**
 * DOM content of a fixed size, panned and zoomed by a camera — what
 * `<CanvasStack>` is for layers drawn to a canvas. The content is laid out at
 * its own size and transformed, so everything inside keeps its layout and a
 * measurement of any element in it reports where it is actually drawn.
 */
export function Stage({
  size,
  view,
  onViewChange,
  minZoom,
  maxZoom,
  onResize,
  hostRef,
  overlay,
  children,
}: StageProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const surface = useSurfaceOptional();
  const handlers = usePanZoom({ view, onViewChange, minZoom, maxZoom });
  const onWheelRef = useRef(handlers.onWheel);
  onWheelRef.current = handlers.onWheel;
  const wheelSlot = useContext(CameraWheelContext);

  // Bound by hand because React registers wheel listeners passive, where
  // `preventDefault` is refused and the page scrolls under the zoom.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const wheel = (e: WheelEvent): void => onWheelRef.current(e, el);
    el.addEventListener('wheel', wheel, { passive: false });
    if (wheelSlot) wheelSlot.current = wheel;
    return () => {
      el.removeEventListener('wheel', wheel);
      if (wheelSlot?.current === wheel) wheelSlot.current = null;
    };
  }, [wheelSlot]);

  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        onResizeRef.current?.({ width: rect.width, height: rect.height });
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A transform moves every tile inside the content without resizing anything,
  // and a ResizeObserver reports only resizes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the camera is the trigger, not an input — the effect re-measures whenever it moves.
  useEffect(() => {
    surface?.invalidateRects();
  }, [surface, view.zoom, view.pan.x, view.pan.y]);

  // The camera changes every frame of a pan, and a transform has nowhere to
  // live but the element's own style: set as custom properties the stylesheet
  // reads.
  const camera = {
    ['--lk-stage-x' as string]: `${view.pan.x}px`,
    ['--lk-stage-y' as string]: `${view.pan.y}px`,
    ['--lk-stage-zoom' as string]: String(view.zoom),
    ['--lk-stage-w' as string]: `${size.width}px`,
    ['--lk-stage-h' as string]: `${size.height}px`,
  } as CSSProperties;

  return (
    <div
      ref={(el) => {
        host.current = el;
        if (hostRef) hostRef.current = el;
      }}
      className="lk-stage"
      onPointerDown={handlers.onPointerDown}
    >
      <div className="lk-stage__content" style={camera}>
        {children}
      </div>
      {overlay}
    </div>
  );
}
