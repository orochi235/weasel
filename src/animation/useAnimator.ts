import { useEffect, useMemo, useRef } from 'react';
import { easeOut, SPRING_PRESETS } from './easings';
import type {
  AnimationHandle,
  Animator,
  TweenOptions,
  SpringOptions,
  DecayOptions,
  UseAnimatorOptions,
} from './types';

interface ActiveAnimation {
  id: number;
  cancelKey?: string;
  paused: boolean;
  timeScale: number;
  virtualNow: number;
  lastRealNow: number | null;
  /** Returns true when finished. Called once per frame with the current virtual-ms timestamp. */
  tick(virtualNow: number): boolean;
  /** Called when the animation is cancelled. Skips onDone. */
  onCancel?(): void;
}

const numericLerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function resolveSpringConstants(o: { preset?: string; stiffness?: number; damping?: number; mass?: number }) {
  const preset = o.preset ? SPRING_PRESETS[o.preset as keyof typeof SPRING_PRESETS] : null;
  return {
    stiffness: o.stiffness ?? preset?.stiffness ?? 170,
    damping: o.damping ?? preset?.damping ?? 26,
    mass: o.mass ?? preset?.mass ?? 1,
  };
}

export function useAnimator(opts: UseAnimatorOptions = {}): Animator {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const animations = useRef<Map<number, ActiveAnimation>>(new Map());
  const nextId = useRef(1);
  const rafHandle = useRef<number | null>(null);
  /**
   * Re-entrancy counter incremented around each animation tick in tickAll.
   * Exposed via `isTicking()`. > 0 ⇒ we're currently inside an animation's
   * onTick; an adapter wrapper (`animateOnSetPose`) seeing this flag should
   * write through to the base adapter rather than schedule a new tween.
   */
  const tickDepth = useRef(0);
  const globalTimeScale = useRef(1);
  const globalPaused = useRef(false);

  // StrictMode-safe cleanup: when the component unmounts (including the
  // dev-mode double-mount that StrictMode performs), cancel every running
  // animation and stop the RAF loop. Without this, the FIRST mount's
  // animator keeps ticking with stale callbacks pointing at the unmounted
  // adapter, while the SECOND mount creates its own animator on top —
  // visible to the user as every animation playing twice.
  const cleanupRef = useRef<(() => void) | null>(null);
  // Tripwire: dev-only flag that every tween/spring/decay's tick reads to
  // detect "animation fired after the host component unmounted." This is a
  // symptom of cleanup not running (regression) — typically because someone
  // refactored useAnimator and forgot to wire the unmount effect. The flag
  // flips false on cleanup; ticks see it and log a one-time error so the
  // bug is loud rather than just visually-doubled animation.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupRef.current?.();
    };
  }, []);
  const trippedRef = useRef(false);
  const tripwire = (): boolean => {
    if (mountedRef.current) return false;
    if (!trippedRef.current) {
      trippedRef.current = true;
      const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
      if (isDev) {
        console.error(
          'weasel useAnimator: animation tick fired after the host component unmounted. ' +
          'This usually means cleanup logic was bypassed — check for refactors that ' +
          'removed the unmount effect or replaced cancelAll with a custom path.',
        );
      }
    }
    return true;
  };

  return useMemo<Animator>(() => {
    // Default to performance.now() so the time origin matches the
    // requestAnimationFrame callback's DOMHighResTimeStamp argument.
    // Using Date.now() here would mix epoch-millis with page-relative-millis,
    // producing huge negative `elapsed` values that clamp tween `t` to 0
    // forever (never reaching completion).
    const now = (): number =>
      (optsRef.current.now ?? (typeof performance !== 'undefined' ? performance.now.bind(performance) : Date.now))();
    const requestFrame = (cb: (t: number) => void): number =>
      (optsRef.current.requestFrame ?? requestAnimationFrame)(cb);
    const cancelFrame = (h: number): void =>
      (optsRef.current.cancelFrame ?? cancelAnimationFrame)(h);

    const ensureLoop = (): void => {
      if (rafHandle.current != null || animations.current.size === 0) return;
      const tickAll = (t: number): void => {
        rafHandle.current = null;
        const finished: number[] = [];
        for (const anim of animations.current.values()) {
          const realDt = anim.lastRealNow == null ? 0 : t - anim.lastRealNow;
          anim.lastRealNow = t;
          const scale = globalPaused.current
            ? 0
            : globalTimeScale.current * (anim.paused ? 0 : anim.timeScale);
          anim.virtualNow += realDt * scale;
          // Increment tick depth around each animation's tick so re-entrant
          // calls (e.g. `decay.onTick` → `adapter.setPose` →
          // `animateOnSetPose` checking `isTicking()`) see the flag and
          // skip scheduling a new wrap-tween that would fight the caller.
          tickDepth.current += 1;
          try {
            if (anim.tick(anim.virtualNow)) finished.push(anim.id);
          } finally {
            tickDepth.current -= 1;
          }
        }
        for (const id of finished) animations.current.delete(id);
        if (animations.current.size > 0) {
          rafHandle.current = requestFrame(tickAll);
        }
      };
      rafHandle.current = requestFrame(tickAll);
    };

    const cancelByKey = (key: string): void => {
      const ids: number[] = [];
      for (const anim of animations.current.values()) {
        if (anim.cancelKey === key) ids.push(anim.id);
      }
      for (const id of ids) {
        const anim = animations.current.get(id);
        anim?.onCancel?.();
        animations.current.delete(id);
      }
    };

    type AnimationSeed = Omit<ActiveAnimation, 'paused' | 'timeScale' | 'virtualNow' | 'lastRealNow'>;
    const register = (seed: AnimationSeed): AnimationHandle => {
      if (seed.cancelKey != null) cancelByKey(seed.cancelKey);
      const anim = seed as ActiveAnimation;
      anim.paused = false;
      anim.timeScale = 1;
      anim.virtualNow = 0;
      // Seed lastRealNow at registration so the first frame's realDt reflects
      // the gap between register() and the first RAF callback. Preserves prior
      // wall-clock-anchored start behavior for tween and gives spring/decay a
      // non-zero first dt sample matching the pre-virtual-clock code.
      anim.lastRealNow = now();
      animations.current.set(anim.id, anim);
      ensureLoop();
      return {
        id: anim.id,
        cancel: () => {
          const a = animations.current.get(anim.id);
          if (!a) return;
          a.onCancel?.();
          animations.current.delete(anim.id);
        },
        pause: () => { const a = animations.current.get(anim.id); if (a) a.paused = true; },
        resume: () => { const a = animations.current.get(anim.id); if (a) a.paused = false; },
        setTimeScale: (s) => { const a = animations.current.get(anim.id); if (a) a.timeScale = s; },
        isPaused: () => animations.current.get(anim.id)?.paused ?? false,
      };
    };

    const tween = <T,>(o: TweenOptions<T>): AnimationHandle => {
      const id = nextId.current++;
      // start is captured in *virtual* time; since virtualNow begins at 0 on
      // registration, that's our reference. The tween's "elapsed" is just
      // virtualNow itself — naturally freezing when paused (virtualNow stops
      // advancing) and decoupled from wall time.
      const start = 0;
      const easing = o.easing ?? easeOut;
      const interp =
        o.interpolate ??
        ((a: T, b: T, t: number) => {
          if (typeof a === 'number' && typeof b === 'number') {
            return numericLerp(a as number, b as number, t) as unknown as T;
          }
          throw new Error('tween: interpolate is required for non-numeric T');
        });
      let lastValueEmitted = false;
      return register({
        id,
        cancelKey: o.cancelKey,
        tick(nowMs) {
          if (tripwire()) return true;
          const elapsed = nowMs - start;
          const t = o.ms <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / o.ms));
          o.onTick(interp(o.from, o.to, easing(t)));
          if (t >= 1 && !lastValueEmitted) {
            lastValueEmitted = true;
            o.onDone?.();
            return true;
          }
          return false;
        },
      });
    };

    const spring = <T,>(o: SpringOptions<T>): AnimationHandle => {
      const id = nextId.current++;
      const isNumeric = typeof o.from === 'number' && typeof o.to === 'number';
      if (!isNumeric && (!o.add || !o.subtract || !o.scale || !o.magnitude)) {
        throw new Error('spring: add/subtract/scale/magnitude are required for non-numeric T');
      }
      const add = o.add ?? ((a: T, b: T) => ((a as unknown as number) + (b as unknown as number)) as unknown as T);
      const subtract = o.subtract ?? ((a: T, b: T) => ((a as unknown as number) - (b as unknown as number)) as unknown as T);
      const scale = o.scale ?? ((v: T, k: number) => ((v as unknown as number) * k) as unknown as T);
      const magnitude = o.magnitude ?? ((v: T) => Math.abs(v as unknown as number));
      const { stiffness, damping, mass } = resolveSpringConstants(o);
      const restThreshold = o.restThreshold ?? 0.01;

      let value = o.from;
      let velocity: T = (o.velocity ?? scale(subtract(o.to, o.from), 0)) as T;
      let lastTime: number | null = null;

      return register({
        id,
        cancelKey: o.cancelKey,
        tick(nowMs) {
          if (tripwire()) return true;
          if (lastTime == null) {
            lastTime = nowMs;
            o.onTick(value);
            return false;
          }
          const dt = Math.min(0.064, (nowMs - lastTime) / 1000); // clamp big jumps
          lastTime = nowMs;
          // Semi-implicit Euler integration of: a = (-k(x - to) - c*v) / m
          const displacement = subtract(value, o.to);
          const springForce = scale(displacement, -stiffness);
          const dampingForce = scale(velocity, -damping);
          const accel = scale(add(springForce, dampingForce), 1 / mass);
          velocity = add(velocity, scale(accel, dt));
          value = add(value, scale(velocity, dt));
          o.onTick(value);
          if (magnitude(velocity) < restThreshold && magnitude(subtract(value, o.to)) < restThreshold) {
            o.onTick(o.to);
            o.onDone?.();
            return true;
          }
          return false;
        },
      });
    };
    const decay = <T,>(o: DecayOptions<T>): AnimationHandle => {
      const id = nextId.current++;
      const friction = o.friction ?? 0.95;
      const threshold = o.threshold ?? 0.5;
      let value = o.from;
      let velocity = o.velocity;
      let lastTime: number | null = null;

      return register({
        id,
        cancelKey: o.cancelKey,
        tick(nowMs) {
          if (tripwire()) return true;
          if (lastTime == null) {
            lastTime = nowMs;
            if (o.magnitude(velocity) < threshold) {
              o.onDone?.();
              return true;
            }
            o.onTick(value);
            return false;
          }
          const dt = Math.min(0.064, (nowMs - lastTime) / 1000);
          lastTime = nowMs;
          // Per-second friction: v *= friction^dt
          velocity = o.scale(velocity, Math.pow(friction, dt));
          value = o.add(value, o.scale(velocity, dt));
          o.onTick(value);
          if (o.magnitude(velocity) < threshold) {
            o.onDone?.();
            return true;
          }
          return false;
        },
      });
    };

    const cancelAll = (): void => {
      for (const a of animations.current.values()) a.onCancel?.();
      animations.current.clear();
      if (rafHandle.current != null) {
        cancelFrame(rafHandle.current);
        rafHandle.current = null;
      }
    };
    cleanupRef.current = cancelAll;
    return {
      tween,
      spring,
      decay,
      cancel: (handle) => {
        const a = animations.current.get(handle.id);
        if (!a) return;
        a.onCancel?.();
        animations.current.delete(handle.id);
      },
      cancelKey: cancelByKey,
      cancelAll,
      isActive: (key) => {
        if (key == null) return animations.current.size > 0;
        for (const a of animations.current.values()) {
          if (a.cancelKey === key) return true;
        }
        return false;
      },
      isTicking: () => tickDepth.current > 0,
      pause: () => { globalPaused.current = true; },
      resume: () => { globalPaused.current = false; },
      isPaused: () => globalPaused.current,
      setTimeScale: (s) => { globalTimeScale.current = s; },
      pauseKey: (key) => {
        for (const a of animations.current.values()) if (a.cancelKey === key) a.paused = true;
      },
      resumeKey: (key) => {
        for (const a of animations.current.values()) if (a.cancelKey === key) a.paused = false;
      },
      setTimeScaleByKey: (key, s) => {
        for (const a of animations.current.values()) if (a.cancelKey === key) a.timeScale = s;
      },
    };
  }, []);
}
