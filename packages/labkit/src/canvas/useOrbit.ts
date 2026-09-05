import { openPointerSession, type PointerSession } from '@weasel-js/core';
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  type WheelEvent,
} from 'react';

/** A point in the space the instrument works in. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** An orbit camera as a trial view: where it looks from, and what it looks at.
 *  labkit does not turn this into a matrix — the host's renderer does. */
export interface OrbitView {
  yaw: number;
  pitch: number;
  distance: number;
  target: Vec3;
}

/** Just short of the pole. At exactly ±PI/2 the azimuth is undefined and the
 *  camera rolls, which reads as the model jumping rather than as a limit. */
export const PITCH_LIMIT = Math.PI / 2 - 0.01;

const YAW_PER_PX = 0.008;
const PITCH_PER_PX = 0.008;
const DISTANCE_PER_NOTCH = 0.0015;
const DRAG_THRESHOLD = 3;

export function clampPitch(pitch: number): number {
  return Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, pitch));
}

export function wrapYaw(yaw: number): number {
  const wrapped = ((((yaw + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

/** The view a drag of (dx, dy) from `start` produces. Absolute against the drag
 *  start, so it can be re-applied any number of times without compounding. */
export function orbitAfterDrag(start: OrbitView, dx: number, dy: number): OrbitView {
  return {
    ...start,
    yaw: wrapYaw(start.yaw + dx * YAW_PER_PX),
    pitch: clampPitch(start.pitch + dy * PITCH_PER_PX),
  };
}

/** Multiplicative, so one notch covers the same proportion of the distance
 *  whether the camera is near or far. */
export function orbitAfterWheel(
  view: OrbitView,
  deltaY: number,
  minDistance: number,
  maxDistance: number,
): OrbitView {
  const factor = Math.exp(deltaY * DISTANCE_PER_NOTCH);
  return {
    ...view,
    distance: Math.min(maxDistance, Math.max(minDistance, view.distance * factor)),
  };
}

export interface UseOrbitOptions {
  view: OrbitView;
  onViewChange: (v: OrbitView) => void;
  /** Restored on double-click. Defaults to the view the hook first saw. */
  home?: OrbitView;
  minDistance?: number;
  maxDistance?: number;
}

export interface OrbitHandlers {
  onWheel: (e: WheelEvent<HTMLElement>) => void;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onDoubleClick: () => void;
  isDragging: () => boolean;
}

interface DragState {
  startX: number;
  startY: number;
  startView: OrbitView;
  moved: boolean;
}

/** Pointer gestures over an orbit view: drag to turn, wheel or pinch to dolly,
 *  double-click to go home. The 3D peer of `usePanZoom`. */
export function useOrbit({
  view,
  onViewChange,
  home,
  minDistance = 0.1,
  maxDistance = 1000,
}: UseOrbitOptions): OrbitHandlers {
  const dragRef = useRef<DragState | null>(null);
  const sessionRef = useRef<PointerSession | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const homeRef = useRef(home ?? view);
  if (home) homeRef.current = home;

  const onWheel = useCallback(
    (e: WheelEvent<HTMLElement>) => {
      e.preventDefault();
      onViewChange(orbitAfterWheel(viewRef.current, e.deltaY, minDistance, maxDistance));
    },
    [onViewChange, minDistance, maxDistance],
  );

  const clearDrag = useCallback(() => {
    dragRef.current = null;
    sessionRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const drag: DragState = {
        startX: e.clientX,
        startY: e.clientY,
        startView: viewRef.current,
        moved: false,
      };
      dragRef.current = drag;
      sessionRef.current = openPointerSession(e.currentTarget, e, {
        onMove: (ev) => {
          const dx = ev.clientX - drag.startX;
          const dy = ev.clientY - drag.startY;
          if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          drag.moved = true;
          onViewChangeRef.current(orbitAfterDrag(drag.startView, dx, dy));
        },
        onEnd: clearDrag,
        // A cancelled turn keeps where it got to: every move was committed as
        // it arrived, so there is nothing left to undo.
        onCancel: clearDrag,
      });
    },
    [clearDrag],
  );

  useEffect(() => () => sessionRef.current?.cancel(), []);

  const onDoubleClick = useCallback(() => onViewChange(homeRef.current), [onViewChange]);
  const isDragging = useCallback(() => dragRef.current?.moved === true, []);

  return { onWheel, onPointerDown, onDoubleClick, isDragging };
}
