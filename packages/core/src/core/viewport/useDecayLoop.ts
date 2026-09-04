import { useCallback, useEffect, useRef } from 'react';
import { useVisibleRaf } from '../../scheduling/useVisibleRaf';

/** Per-axis limits on a view's position. Any side may be left open. */
export interface PanBounds {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
}

/** Momentum settings for a pan: how quickly a flung view slows, when it stops,
 *  and what happens at the pan limits. The `DecayLoopConfig` fields a caller
 *  chooses up front, without the per-gesture `velocity` / `onTick`. */
export interface InertiaConfig {
  friction?: number;
  minSpeed?: number;
  /** What to do when inertial pan reaches `bounds`. Default: no clamping. */
  boundary?: 'stop' | 'bounce' | 'spring';
  /** View-coordinate limits for boundary clamping. Requires `boundary` to take effect. */
  bounds?: PanBounds;
}

/** How a decay should run: its starting velocity, how fast it slows, and what
 *  happens if it reaches the pan limits. */
export interface DecayLoopConfig {
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
  /** Starting position for internal boundary tracking. Required when `viewBounds` is set. */
  initialPosition?: { x: number; y: number };
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

/** A rAF loop that coasts a value to a stop under friction, reporting the
 *  per-frame delta. What turns a released pan drag into momentum scrolling. */
export function useDecayLoop() {
  const stateRef = useRef<{
    vx: number; vy: number;
    friction: number; minSpeed: number;
    lastTime: number | null;
    posX: number; posY: number;
    viewBounds: PanBounds | undefined;
    boundary: 'stop' | 'bounce' | 'spring' | undefined;
    onTick: (dx: number, dy: number) => void;
    onEnd?: () => void;
  } | null>(null);

  const frameLoop = useVisibleRaf(
    (now: number) => { tick(now); },
    {
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

  const tick = useCallback((now: number) => {
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
    const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
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
      const newX = s.posX + dx;
      const newY = s.posY + dy;
      if (s.boundary === 'stop') {
        if (minX !== undefined && newX < minX) { dx = minX - s.posX; s.vx = 0; }
        else if (maxX !== undefined && newX > maxX) { dx = maxX - s.posX; s.vx = 0; }
        if (minY !== undefined && newY < minY) { dy = minY - s.posY; s.vy = 0; }
        else if (maxY !== undefined && newY > maxY) { dy = maxY - s.posY; s.vy = 0; }
      } else if (s.boundary === 'spring') {
        // Damped reflection: flip sign AND scale magnitude by SPRING_DAMPING so
        // each bounce loses energy. Once |v| < minSpeed the outer loop ends.
        if (minX !== undefined && newX < minX) { dx = minX - s.posX; s.vx = Math.abs(s.vx) * SPRING_DAMPING; }
        else if (maxX !== undefined && newX > maxX) { dx = maxX - s.posX; s.vx = -Math.abs(s.vx) * SPRING_DAMPING; }
        if (minY !== undefined && newY < minY) { dy = minY - s.posY; s.vy = Math.abs(s.vy) * SPRING_DAMPING; }
        else if (maxY !== undefined && newY > maxY) { dy = maxY - s.posY; s.vy = -Math.abs(s.vy) * SPRING_DAMPING; }
      } else {
        if (minX !== undefined && newX < minX) { dx = minX - s.posX; s.vx = Math.abs(s.vx); }
        else if (maxX !== undefined && newX > maxX) { dx = maxX - s.posX; s.vx = -Math.abs(s.vx); }
        if (minY !== undefined && newY < minY) { dy = minY - s.posY; s.vy = Math.abs(s.vy); }
        else if (maxY !== undefined && newY > maxY) { dy = maxY - s.posY; s.vy = -Math.abs(s.vy); }
      }
      s.posX += dx;
      s.posY += dy;
    }
    s.onTick(dx, dy);
    frameLoop.request();
  }, [frameLoop]);

  const start = useCallback((config: DecayLoopConfig) => {
    cancel();
    const { velocity, friction = 0.92, minSpeed = 0.01, viewBounds, boundary, initialPosition, onTick, onEnd } = config;
    const speed = Math.sqrt(velocity.vx ** 2 + velocity.vy ** 2);
    if (speed < minSpeed) { onEnd?.(); return; }
    stateRef.current = {
      vx: velocity.vx, vy: velocity.vy, friction, minSpeed, lastTime: null,
      posX: initialPosition?.x ?? 0, posY: initialPosition?.y ?? 0,
      viewBounds, boundary,
      onTick, onEnd,
    };
    frameLoop.request();
  }, [cancel, frameLoop]);

  useEffect(() => () => { cancel(); }, [cancel]);

  return { start, cancel };
}
