import { useCallback, useEffect, useRef } from 'react';

export interface DecayLoopConfig {
  velocity: { vx: number; vy: number };
  friction?: number;
  minSpeed?: number;
  onTick: (dx: number, dy: number) => void;
  onEnd?: () => void;
}

export function useDecayLoop() {
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef<{
    vx: number; vy: number;
    friction: number; minSpeed: number;
    lastTime: number | null;
    onTick: (dx: number, dy: number) => void;
    onEnd?: () => void;
  } | null>(null);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stateRef.current = null;
  }, []);

  const tick = useCallback((now: number) => {
    const s = stateRef.current;
    if (!s) return;
    if (s.lastTime === null) {
      s.lastTime = now;
      rafRef.current = requestAnimationFrame(tick);
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
      rafRef.current = null;
      s.onEnd?.();
      return;
    }
    s.onTick(s.vx * dt, s.vy * dt);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback((config: DecayLoopConfig) => {
    cancel();
    const { velocity, friction = 0.92, minSpeed = 0.01, onTick, onEnd } = config;
    const speed = Math.sqrt(velocity.vx ** 2 + velocity.vy ** 2);
    if (speed < minSpeed) { onEnd?.(); return; }
    stateRef.current = { vx: velocity.vx, vy: velocity.vy, friction, minSpeed, lastTime: null, onTick, onEnd };
    rafRef.current = requestAnimationFrame(tick);
  }, [cancel, tick]);

  useEffect(() => () => { cancel(); }, [cancel]);

  return { start, cancel };
}
