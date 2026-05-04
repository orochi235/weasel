import { useMemo, useRef } from 'react';
import { easeOut } from './easings';
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

export function useAnimator(opts: UseAnimatorOptions = {}): Animator {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const animations = useRef<Map<number, ActiveAnimation>>(new Map());
  const nextId = useRef(1);
  const rafHandle = useRef<number | null>(null);

  return useMemo<Animator>(() => {
    const now = (): number => (optsRef.current.now ?? Date.now)();
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

    const spring = <T,>(_o: SpringOptions<T>): AnimationHandle => {
      throw new Error('spring: not implemented yet (Task 4)');
    };
    const decay = <T,>(_o: DecayOptions<T>): AnimationHandle => {
      throw new Error('decay: not implemented yet (Task 5)');
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
