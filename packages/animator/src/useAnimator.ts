import { useCallback, useEffect, useInsertionEffect, useMemo, useRef } from 'react';
import { isDev, useLatest, useVisibleRaf } from '@weasel-js/react';
import type { Clock } from '@weasel-js/clock';
import { ColorOverrideRegistry } from './colorRegistry';
import { createAnimatorCore, type AnimatorCore } from './engine/core';
import type { Animator } from './types';
import type { UseAnimatorOptions } from './useAnimatorOptions';

/** Create the animator for a canvas. One rAF loop drives every animation it
 *  owns, or the clock in `opts.clock` does, and everything still running is
 *  canceled on unmount. */
export function useAnimator(opts: UseAnimatorOptions = {}): Animator {
  const optsRef = useLatest(opts);
  const colorOverrides = useRef<ColorOverrideRegistry>(new ColorOverrideRegistry());

  // The loop runs behind the visibility gate. The core is built in the memo
  // below, so the frame callback reaches it through a ref, published once the
  // memo's render commits. On a clock, the clock's frames advance it, and the
  // loop only shows a change made between them, at the time the clock stands.
  const coreRef = useRef<AnimatorCore | null>(null);
  const followingRef = useRef(false);
  const follow = useCallback((clock: Clock) => {
    followingRef.current = true;
    try { coreRef.current?.follow(clock.elapsed, clock.rate); } finally { followingRef.current = false; }
  }, []);
  const frameLoop = useVisibleRaf(
    useCallback((t: number) => {
      const handle = optsRef.current.clock;
      if (handle) follow(handle.clock);
      else coreRef.current?.tick(t);
    }, [follow, optsRef]),
    {
      requestFrame: opts.requestFrame,
      cancelFrame: opts.cancelFrame,
      onResume: () => { if (!optsRef.current.clock) coreRef.current?.resumed(); },
    },
  );
  const frameLoopRef = useLatest(frameLoop);

  // Tripwire: dev-only flag that every tween/spring/decay's tick reads to
  // detect "animation fired after the host component unmounted." This is a
  // symptom of cleanup not running (regression) — typically because someone
  // refactored useAnimator and forgot to wire the unmount effect. The flag
  // flips false on cleanup; ticks see it and log a one-time error so the
  // bug is loud rather than just visually-doubled animation.
  const mountedRef = useRef(true);
  const trippedRef = useRef(false);

  const core = useMemo(() => {
    const tripwire = (): boolean => {
      if (mountedRef.current) return false;
      if (!trippedRef.current) {
        trippedRef.current = true;
        if (isDev()) {
          console.error(
            'weasel useAnimator: animation tick fired after the host component unmounted. ' +
            'This usually means cleanup logic was bypassed — check for refactors that ' +
            'removed the unmount effect or replaced cancelAll with a custom path.',
          );
        }
      }
      return true;
    };
    // Default to performance.now() so the time origin matches the
    // requestAnimationFrame callback's DOMHighResTimeStamp argument.
    // Using Date.now() here would mix epoch-millis with page-relative-millis,
    // producing huge negative `elapsed` values that clamp tween `t` to 0
    // forever (never reaching completion).
    const now = (): number => {
      const handle = optsRef.current.clock;
      if (handle) return handle.clock.elapsed;
      return (optsRef.current.now ?? (typeof performance !== 'undefined' ? performance.now.bind(performance) : Date.now))();
    };
    return createAnimatorCore({
      now,
      // On a clock, a frame asked for from inside one comes with the clock's next move: one shown
      // at the same time would only ask again.
      requestFrame: () => { if (!followingRef.current) frameLoopRef.current.request(); },
      cancelFrame: () => frameLoopRef.current.cancel(),
      tripwire,
      colorOverrides: colorOverrides.current,
    });
  }, [frameLoopRef, optsRef]);

  useInsertionEffect(() => {
    coreRef.current = core;
  }, [core]);

  // StrictMode-safe cleanup: when the component unmounts (including the
  // dev-mode double-mount that StrictMode performs), cancel every running
  // animation and stop the RAF loop. Without this, the FIRST mount's
  // animator keeps ticking with stale callbacks pointing at the unmounted
  // adapter, while the SECOND mount creates its own animator on top —
  // visible to the user as every animation playing twice.
  const handle = opts.clock;
  useEffect(() => {
    if (!handle) return;
    // The last frame's time may stand on another clock's.
    core.resumed();
    return handle.onFrame(() => { if (core.api.isActive()) follow(handle.clock); });
  }, [core, handle, follow]);

  const { api } = core;
  useEffect(() => {
    const overrides = colorOverrides.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      api.cancelAll();
      overrides.clearAll();
    };
  }, [api]);

  return api;
}
