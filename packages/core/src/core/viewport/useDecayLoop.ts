import { useCallback, useEffect, useRef } from 'react';
import { useVisibleRaf, type VisibleRaf } from '@weasel-js/react';
import { checkInertia } from './checkInertia';

/** Per-axis limits on a view's position. Any side may be left open. */
export interface PanBounds {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
}

/** Momentum settings for a pan: how quickly a flung view slows, when it stops,
 *  and what happens at the pan limits. The `DecayLoopOptions` fields a caller
 *  chooses up front, without the per-gesture `velocity` / `onTick`. */
export interface InertiaOptions {
  /** Share of speed kept each 60 Hz frame, in (0, 1). Default 0.92. */
  friction?: number;
  /** Speed, in units per ms, below which the coast ends; positive. Default 0.01. */
  minSpeed?: number;
  /** What to do when inertial pan reaches `bounds`. Default: no clamping. */
  boundary?: 'stop' | 'bounce' | 'spring';
  /** View-coordinate limits for boundary clamping. Requires `boundary` to take effect. */
  bounds?: PanBounds;
}

/** How a decay should run: its starting velocity, how fast it slows, and what
 *  happens if it reaches the pan limits. */
export interface DecayLoopOptions {
  velocity: { vx: number; vy: number };
  friction?: number;
  minSpeed?: number;
  /** Bounds for boundary clamping. Requires `boundary` to take effect. */
  viewBounds?: PanBounds;
  /**
   * What to do when the accumulated position hits `viewBounds`. Default: no clamping.
   * - `'stop'`: clamp at boundary, kill velocity component.
   * - `'bounce'`: linear reflection — flip velocity sign, magnitude preserved.
   * - `'spring'`: damped reflection — flip velocity sign and shrink magnitude
   *   by `SPRING_DAMPING` per bounce so the motion settles naturally.
   */
  boundary?: 'stop' | 'bounce' | 'spring';
  /** Starting position for internal boundary tracking, used when no `position` is given.
   *  `viewBounds` with a `boundary` needs one of the two. */
  initialPosition?: { x: number; y: number };
  /** Reads the live position each frame for boundary checks, so a move made by
   *  anything else mid-coast is seen. Without it, the loop tracks its own sum of
   *  deltas from `initialPosition`. */
  position?: () => { x: number; y: number };
  onTick: (dx: number, dy: number) => void;
  onEnd?: () => void;
}

/**
 * Fraction of velocity preserved per `'spring'` bounce. 0.5 means each bounce
 * loses half its energy, giving a quick visible settle (typically 2–4 bounces
 * before `minSpeed` cuts the loop). Fixed for v1; a future `bounceDamping`
 * config option could expose this if a consumer needs control.
 */
const SPRING_DAMPING = 0.5;

/**
 * One axis of a coast meeting its limits: the step `d` it may take from `pos`
 * and the velocity `v` it leaves with. A view already past a limit meets its
 * wall where it is, so it coasts back in freely rather than jumping to the limit.
 */
function hitWall(
  boundary: 'stop' | 'bounce' | 'spring', pos: number, d: number, v: number, min?: number, max?: number,
): { d: number; v: number } {
  const lo = min === undefined ? undefined : Math.min(min, pos);
  const hi = max === undefined ? undefined : Math.max(max, pos);
  const next = pos + d;
  let side: 1 | -1;
  let wall: number;
  if (lo !== undefined && next < lo) { side = 1; wall = lo; }
  else if (hi !== undefined && next > hi) { side = -1; wall = hi; }
  else return { d, v };
  const keep = boundary === 'stop' ? 0 : boundary === 'spring' ? SPRING_DAMPING : 1;
  return { d: wall - pos, v: side * Math.abs(v) * keep };
}

/** A rAF loop that coasts a value to a stop under friction, reporting the
 *  per-frame delta. What turns a released pan drag into momentum scrolling. */
export function useDecayLoop() {
  const stateRef = useRef<{
    vx: number; vy: number;
    friction: number; minSpeed: number;
    lastTime: number | null;
    posX: number; posY: number;
    position: (() => { x: number; y: number }) | undefined;
    viewBounds: PanBounds | undefined;
    boundary: 'stop' | 'bounce' | 'spring' | undefined;
    onTick: (dx: number, dy: number) => void;
    onEnd?: () => void;
  } | null>(null);

  const tick = useCallback((now: number, frameLoop: VisibleRaf) => {
    const s = stateRef.current;
    if (!s) return;
    if (s.lastTime === null) {
      s.lastTime = now;
      frameLoop.request();
      return;
    }
    const dt = Math.min(now - s.lastTime, 64);  // cap at 64ms to avoid huge jumps
    s.lastTime = now;
    // Time-normalize friction to 60fps baseline
    const f = Math.pow(s.friction, dt / 16.67);
    s.vx *= f;
    s.vy *= f;
    const speed = Math.hypot(s.vx, s.vy);
    if (speed < s.minSpeed) {
      stateRef.current = null;
      frameLoop.cancel();
      s.onEnd?.();
      return;
    }
    let dx = s.vx * dt;
    let dy = s.vy * dt;
    if (s.viewBounds && s.boundary) {
      const { minX, maxX, minY, maxY } = s.viewBounds;
      if (s.position) { const p = s.position(); s.posX = p.x; s.posY = p.y; }
      const ax = hitWall(s.boundary, s.posX, dx, s.vx, minX, maxX);
      const ay = hitWall(s.boundary, s.posY, dy, s.vy, minY, maxY);
      dx = ax.d; s.vx = ax.v;
      dy = ay.d; s.vy = ay.v;
      s.posX += dx;
      s.posY += dy;
    }
    s.onTick(dx, dy);
    frameLoop.request();
  }, []);

  const frameLoop = useVisibleRaf(
    tick,
    {
      phase: 'update',
      // Coasting does not continue while suspended: dropping `lastTime` makes
      // the resuming frame seed a fresh interval instead of applying an hour of
      // friction at once, which would end the decay before it was seen.
      onResume: useCallback(() => {
        if (stateRef.current) stateRef.current.lastTime = null;
      }, []),
    },
  );

  const cancel = useCallback(() => {
    frameLoop.cancel();
    stateRef.current = null;
  }, [frameLoop]);

  const start = useCallback((config: DecayLoopOptions) => {
    checkInertia('useDecayLoop', config);
    if (config.viewBounds && config.boundary && !config.position && !config.initialPosition) {
      throw new TypeError('useDecayLoop: viewBounds with a boundary needs a position or an initialPosition to check them from');
    }
    cancel();
    const { velocity, friction = 0.92, minSpeed = 0.01, viewBounds, boundary, initialPosition, position, onTick, onEnd } = config;
    const speed = Math.hypot(velocity.vx, velocity.vy);
    // A non-finite velocity is a bad measurement, not a fling: friction never brings it down.
    if (!Number.isFinite(speed) || speed < minSpeed) { onEnd?.(); return; }
    stateRef.current = {
      vx: velocity.vx, vy: velocity.vy, friction, minSpeed, lastTime: null,
      posX: initialPosition?.x ?? 0, posY: initialPosition?.y ?? 0,
      position, viewBounds, boundary,
      onTick, onEnd,
    };
    frameLoop.request();
  }, [cancel, frameLoop]);

  useEffect(() => () => { cancel(); }, [cancel]);

  return { start, cancel };
}
