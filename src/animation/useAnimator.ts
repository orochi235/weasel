import { useMemo, useRef } from 'react';
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
  /** Returns true when finished. Called once per frame with the current ms timestamp. */
  tick(now: number): boolean;
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
          if (anim.tick(t)) finished.push(anim.id);
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

    const register = (anim: ActiveAnimation): AnimationHandle => {
      if (anim.cancelKey != null) cancelByKey(anim.cancelKey);
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
      };
    };

    const tween = <T,>(o: TweenOptions<T>): AnimationHandle => {
      const id = nextId.current++;
      const start = now();
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
      cancelAll: () => {
        for (const a of animations.current.values()) a.onCancel?.();
        animations.current.clear();
        if (rafHandle.current != null) {
          cancelFrame(rafHandle.current);
          rafHandle.current = null;
        }
      },
      isActive: (key) => {
        if (key == null) return animations.current.size > 0;
        for (const a of animations.current.values()) {
          if (a.cancelKey === key) return true;
        }
        return false;
      },
    };
  }, []);
}
