import { useCallback, useEffect, useInsertionEffect, useMemo, useRef } from 'react';
import { useLatest, useVisibleRaf } from '@weasel-js/react';
import { createLoop, createTweenLoop } from './loop';
import { createCodec } from './engine/codec';
import type { ActiveAnimation, AnimationContext, AnimationSeed } from './engine/context';
import type { TargetState } from './target';
import { decayAsPhysics } from './engine/decay';
import { startHold } from './engine/holdAnimation';
import { openHold } from './engine/holds';
import { createTargetBook } from './engine/offsets';
import { startOffsetPhysics } from './engine/offsetPhysics';
import { startOffsetTween } from './engine/offsetTween';
import { startPhysics } from './engine/physicsAnimation';
import { startTween } from './engine/tweenAnimation';
import { createStagger } from './stagger';
import { createTimeline } from './timeline/createTimeline';
import { stateOf } from './target';
import { ColorOverrideRegistry } from './colorRegistry';
import { AnimatorEventHub } from './observe';
import { supervisors, type WatchCompletion } from './supervisor';
import type {
  AnimationHandle,
  AnimationInfo,
  AnimationKind,
  Animator,
  TweenOptions,
  SpringOptions,
  DecayOptions,
  PhysicsOptions,
  PhysicsHandle,
  TargetDecayOptions,
  TargetPhysicsOptions,
  TargetSpringOptions,
  TargetTweenOptions,
  UseAnimatorOptions,
  LiveAnimation,
} from './types';
import type { OpenTrackHold } from './timeline/trackHolds';
import type { TimelineOptions } from './timeline/types';

/** Create the animator for a canvas. One rAF loop drives every animation it
 *  owns, and everything still running is cancelled on unmount. */
export function useAnimator(opts: UseAnimatorOptions = {}): Animator {
  const optsRef = useLatest(opts);
  const animations = useRef<Map<number, ActiveAnimation>>(new Map());
  const nextId = useRef(1);
  /**
   * Re-entrancy counter incremented around each animation tick in tickAll.
   * Exposed via `isTicking()`. > 0 ⇒ we're currently inside an animation's
   * onTick; an adapter wrapper (`animateOnSetPose`) seeing this flag should
   * write through to the base adapter rather than schedule a new tween.
   */
  const tickDepth = useRef(0);
  /** The timestamp the codec last advanced to. Null after the page was hidden and while nothing
   *  runs, so neither gap is charged to the codec; a tween starting then seeds it from `now()`. */
  const codecFrameT = useRef<number | null>(null);
  const globalTimeScale = useRef(1);
  const globalPaused = useRef(false);
  const colorOverrides = useRef<ColorOverrideRegistry>(new ColorOverrideRegistry());
  // Per-frame tick subscribers. Notified after each batch of animation
  // ticks (i.e. after `colorOverrides` has settled to its latest values
  // but before the next RAF schedules). Used by `<SceneCanvas animator>`
  // to request a redraw on every active frame.
  const tickSubscribers = useRef<Set<() => void>>(new Set());

  // The loop runs behind the visibility gate. `tickAll` is built inside the
  // memo below, so the frame callback reaches it through a ref, published
  // once the memo's render commits.
  const tickAllRef = useRef<((t: number) => void) | null>(null);
  const frameLoop = useVisibleRaf(
    useCallback((t: number) => { tickAllRef.current?.(t); }, []),
    {
      requestFrame: opts.requestFrame,
      cancelFrame: opts.cancelFrame,
      // An hour spent hidden is not an hour the animation ran: dropping each
      // animation's last timestamp makes the resuming frame's `realDt` zero.
      onResume: () => {
        for (const anim of animations.current.values()) anim.lastRealNow = null;
        codecFrameT.current = null;
      },
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

  const { api, tickAll } = useMemo(() => {
    // Default to performance.now() so the time origin matches the
    // requestAnimationFrame callback's DOMHighResTimeStamp argument.
    // Using Date.now() here would mix epoch-millis with page-relative-millis,
    // producing huge negative `elapsed` values that clamp tween `t` to 0
    // forever (never reaching completion).
    const now = (): number =>
      (optsRef.current.now ?? (typeof performance !== 'undefined' ? performance.now.bind(performance) : Date.now))();
    /** Supervisor frame callbacks due this frame, run once its ticks are done. */
    const afterTicks: (() => void)[] = [];

    // Per-id one-shot completion listeners. Used by stagger to detect when
    // each child has left the registry (natural completion OR cancel) so the
    // supervising composite can retire itself when the last child finishes.
    const completionListeners = new Map<number, (() => void)[]>();
    const fireCompletion = (id: number): void => {
      const ls = completionListeners.get(id);
      if (!ls) return;
      completionListeners.delete(id);
      for (const cb of ls) cb();
    };
    const watchCompletion: WatchCompletion = (id, cb) => {
      if (!animations.current.has(id)) {
        cb();
        return () => {};
      }
      const ls = completionListeners.get(id) ?? [];
      ls.push(cb);
      completionListeners.set(id, ls);
      return () => {
        const cur = completionListeners.get(id);
        if (!cur) return;
        const idx = cur.indexOf(cb);
        if (idx >= 0) cur.splice(idx, 1);
        if (cur.length === 0) completionListeners.delete(id);
      };
    };

    const hub = new AnimatorEventHub();
    const codec = createCodec();
    const targets = createTargetBook({
      stop: (s) => {
        for (const a of [...animations.current.values()]) if (a.target === s) retire(a.id);
      },
      reread: (s) => {
        codec.touch(s);
        reread();
      },
    });
    const infoOf = (a: ActiveAnimation): AnimationInfo => {
      if (!a.info) {
        const info: { -readonly [K in keyof AnimationInfo]: AnimationInfo[K] } = { id: a.id, kind: a.kind };
        if (a.cancelKey != null) info.key = a.cancelKey;
        if (a.label != null) info.label = a.label;
        a.info = info;
      }
      return a.info;
    };

    /** Report `id` as finished, ahead of its `onDone`, so whatever that
     *  handler starts is heard after it. Nothing revives a primitive; a
     *  timeline, which can be revived, is reported as it leaves the table. */
    const reportEnd = (id: number): void => {
      const a = animations.current.get(id);
      if (!a || a.ended) return;
      a.ended = true;
      if (hub.watched) hub.emit({ type: 'end', animation: infoOf(a) });
    };

    /** Take `id` off the table as canceled — or, given `by`, as interrupted by
     *  the animation claiming its key; given `error`, the caller reports it. */
    const retire = (id: number, by?: ActiveAnimation, error?: true): void => {
      const a = animations.current.get(id);
      if (!a) return;
      a.onCancel?.();
      codec.stop(id);
      animations.current.delete(id);
      // A target that came to rest is owed one more show, and no frame may be coming.
      if (targets.resting) frameLoopRef.current.request();
      fireCompletion(id);
      if (!hub.watched || a.ended || error) return;
      hub.emit(by
        ? { type: 'interrupt', animation: infoOf(a), by: infoOf(by) }
        : { type: 'cancel', animation: infoOf(a) });
    };

    /** Whether a frame is between reading the codec and showing its targets. */
    let framing = false;
    const reread = (): void => codec.refresh((on, queued) => targets.reread(on as TargetState, queued));
    const awake = (): boolean => {
      for (const a of animations.current.values()) if (!a.idle) return true;
      return false;
    };

    const tickAll = (t: number): void => {
      const finished: ActiveAnimation[] = [];
      const threw: [ActiveAnimation, unknown][] = [];
      const frameDt = codecFrameT.current == null ? 0 : Math.max(0, t - codecFrameT.current);
      codecFrameT.current = t;
      framing = true;
      codec.frame(frameDt * (globalPaused.current ? 0 : globalTimeScale.current));
      targets.settle();
      // A snapshot: an animation registered by this frame's ticks first ticks on the
      // next, or a zero-duration loop would chain inside one frame and never leave it.
      for (const anim of [...animations.current.values()]) {
        if (animations.current.get(anim.id) !== anim) continue;
        // `t` comes from the frame clock; `lastRealNow` is seeded at register()
        // from `now()` while the animator is idle. The two share a time origin in a browser, where the rAF
        // timestamp and `performance.now()` are both page-relative — but not
        // everywhere: jsdom starts them ~600ms apart, which made the first
        // frame's delta hugely negative and left `virtualNow` climbing back
        // toward zero for dozens of frames before a tween advanced at all.
        // Time never runs backwards, so a negative sample is never real.
        const realDt = anim.lastRealNow == null ? 0 : Math.max(0, t - anim.lastRealNow);
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
          if (anim.tick(anim.virtualNow, scale)) finished.push(anim);
        } catch (error) {
          threw.push([anim, error]);
        } finally {
          tickDepth.current -= 1;
        }
      }
      for (const [anim, error] of threw) {
        console.error('useAnimator: animation tick threw; retiring it', error);
        if (animations.current.get(anim.id) !== anim) continue;
        // One that ended before throwing (from `onDone`) is finished, not canceled.
        if (anim.ended) {
          animations.current.delete(anim.id);
          fireCompletion(anim.id);
        } else {
          retire(anim.id, undefined, true);
        }
        if (hub.watched) hub.emit({ type: 'error', animation: infoOf(anim), error });
      }
      for (const anim of finished) {
        // Gone already if its own tick canceled it; replaced if something
        // revived it under the same id since.
        if (animations.current.get(anim.id) !== anim) continue;
        reportEnd(anim.id);
        animations.current.delete(anim.id);
        fireCompletion(anim.id);
      }
      for (const cb of afterTicks.splice(0)) {
        try { cb(); } catch (err) { console.error('useAnimator: a staggered start threw', err); }
      }
      reread();
      framing = false;
      targets.show();
      // Notify every onTick subscriber AFTER the tick batch so they
      // see the latest `colorOverrides` / pose values. Errors in one
      // subscriber don't suppress the others.
      for (const sub of tickSubscribers.current) {
        try { sub(); } catch (err) { console.error('useAnimator: onTick subscriber threw', err); }
      }
      if (awake()) {
        frameLoopRef.current.request();
        return;
      }
      // As when the page was hidden: the time asleep is charged to nothing.
      codecFrameT.current = null;
      for (const anim of animations.current.values()) anim.lastRealNow = null;
    };

    const ensureLoop = (): void => {
      // A frame in progress asks for the next one itself, after `onTick`: asked for from a tick,
      // it would run ahead of a paint `onTick` requests, and the tick after would paint nothing.
      if (animations.current.size === 0 || framing) return;
      frameLoopRef.current.request();
    };

    const cancelByKey = (key: string, by?: ActiveAnimation): void => {
      const ids: number[] = [];
      for (const anim of animations.current.values()) {
        if (anim.cancelKey === key) ids.push(anim.id);
      }
      for (const id of ids) retire(id, by);
    };

    /** Gives a codec subject the rate its own pause and time scale now ask for. */
    const rateOf = (a: ActiveAnimation): void => {
      if (codec.has(a.id)) codec.rate(a.id, a.paused ? 0 : a.timeScale);
      a.onRate?.(a.paused, a.timeScale);
    };

    const register = (seed: AnimationSeed): AnimationHandle => {
      const anim = seed as ActiveAnimation;
      if (seed.cancelKey != null && !seed.keepExisting) cancelByKey(seed.cancelKey, anim);
      anim.paused = false;
      anim.timeScale = 1;
      anim.virtualNow = 0;
      // Seeded from the frame clock where it is running, as a voice cued now is: both then
      // advance by the whole of their first frame. Idle, the first frame's realDt is the gap
      // between register() and the first RAF callback.
      anim.lastRealNow = codecFrameT.current ?? now();
      animations.current.set(anim.id, anim);
      if (anim.target) targets.showNow(anim.target);
      if (hub.watched) hub.emit({ type: 'start', animation: infoOf(anim) });
      ensureLoop();
      return {
        id: anim.id,
        cancel: () => retire(anim.id),
        pause: () => { const a = animations.current.get(anim.id); if (a) { a.paused = true; rateOf(a); } },
        resume: () => { const a = animations.current.get(anim.id); if (a) { a.paused = false; rateOf(a); } },
        setTimeScale: (s) => { const a = animations.current.get(anim.id); if (a) { a.timeScale = s; rateOf(a); } },
        timeScale: () => animations.current.get(anim.id)?.timeScale ?? 1,
        isPaused: () => animations.current.get(anim.id)?.paused ?? false,
      };
    };

    const finish = (id: number): void => {
      if (!animations.current.has(id)) return;
      reportEnd(id);
      animations.current.delete(id);
      fireCompletion(id);
    };

    const createSupervisor = supervisors({
      nextId: () => nextId.current++,
      register,
      finish,
      afterTicks: (cb) => { afterTicks.push(cb); },
    });

    const ctx: AnimationContext = {
      codec,
      targets,
      nextId: () => nextId.current++,
      seedClock: () => { if (codecFrameT.current == null) codecFrameT.current = now(); },
      register,
      has: (id) => animations.current.has(id),
      reportEnd,
      finish,
      touch: (target, at) => {
        codec.touch(target);
        if (framing && !at) return;
        reread();
        if (!framing) frameLoopRef.current.request();
      },
      tripwire,
      interrupt: (key, by) => cancelByKey(key, by as ActiveAnimation),
      velocityUnder: (key, target) => {
        let sum: number[] | null = null;
        for (const a of animations.current.values()) {
          if (a.cancelKey !== key || a.target !== target) continue;
          const v = codec.own(a.id)?.velocity;
          if (v) sum = sum ? sum.map((x, i) => x + v[i]!) : v.slice();
        }
        return sum;
      },
    };

    const tween = <T,>(o: TweenOptions<T> | TargetTweenOptions<T>): AnimationHandle =>
      (o.target ? startOffsetTween(ctx, o) : startTween(ctx, o));

    const physics = <T,>(
      o: PhysicsOptions<T> | TargetPhysicsOptions<T>,
      kind: AnimationKind = 'physics',
    ): PhysicsHandle<T> => (o.target ? startOffsetPhysics(ctx, o, kind) : startPhysics(ctx, o, kind));

    const spring = <T,>(o: SpringOptions<T> | TargetSpringOptions<T>): AnimationHandle => physics<T>(o, 'spring');

    const decay = <T,>(o: DecayOptions<T> | TargetDecayOptions<T>): AnimationHandle =>
      physics<T>(decayAsPhysics(o), 'decay');

    const cancelAll = (): void => {
      const retired: ActiveAnimation[] = [];
      for (const a of animations.current.values()) {
        a.onCancel?.();
        codec.stop(a.id);
        retired.push(a);
      }
      animations.current.clear();
      codecFrameT.current = null;
      targets.show();
      for (const a of retired) fireCompletion(a.id);
      if (hub.watched) for (const a of retired) hub.emit({ type: 'cancel', animation: infoOf(a) });
      frameLoopRef.current.cancel();
    };
    const api: Animator = {
      tween,
      spring,
      decay,
      physics,
      hold: (o) => startHold(ctx, o),
      cancel: (handle) => retire(handle.id),
      cancelKey: (key) => cancelByKey(key),
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
      timeScale: () => globalTimeScale.current,
      pauseKey: (key) => {
        for (const a of animations.current.values()) if (a.cancelKey === key) { a.paused = true; rateOf(a); }
      },
      resumeKey: (key) => {
        for (const a of animations.current.values()) if (a.cancelKey === key) { a.paused = false; rateOf(a); }
      },
      setTimeScaleByKey: (key, s) => {
        for (const a of animations.current.values()) if (a.cancelKey === key) { a.timeScale = s; rateOf(a); }
      },
      loop: (factory, loopOpts) => createLoop(createSupervisor, factory, loopOpts),
      tweenLoop: (tweenLoopOpts) =>
        createTweenLoop(api, createSupervisor, tweenLoopOpts),
      stagger: ((items, delay, factory, staggerOpts) =>
        createStagger(
          api,
          createSupervisor,
          watchCompletion,
          items,
          delay,
          factory as never,
          staggerOpts,
        )) as Animator['stagger'],
      timeline: (o: TimelineOptions) => {
        const id = nextId.current++;
        const info = (): AnimationInfo | undefined => {
          const a = animations.current.get(id);
          return a && infoOf(a);
        };
        const hold: OpenTrackHold = (target, value, weight) =>
          openHold(ctx, { target: stateOf(target), value, weight });
        return createTimeline(register, id, o, {
          get watched() { return hub.watched; },
          fire: (track, path, event, lateBy) => {
            const animation = info();
            if (animation) hub.emit({ type: 'fire', animation, track, path: path.slice(), event, lateBy });
          },
          lap: (lap) => {
            const animation = info();
            if (animation) hub.emit({ type: 'lap', animation, lap });
          },
        }, hold);
      },
      colorOverrides: colorOverrides.current,
      onTick: (cb) => {
        tickSubscribers.current.add(cb);
        return () => { tickSubscribers.current.delete(cb); };
      },
      keepAlive: () => {
        const sup = createSupervisor({ kind: 'keepAlive' });
        return () => sup.cancel();
      },
      watch: (listener) => hub.add(listener),
      live: () => {
        const rows: LiveAnimation[] = [];
        for (const a of animations.current.values()) {
          const row: LiveAnimation = {
            ...infoOf(a),
            paused: a.paused,
            timeScale: a.timeScale,
            elapsed: a.virtualNow,
            ...(a.progress ? { progress: a.progress(a.virtualNow) } : {}),
          };
          rows.push(row);
        }
        return rows;
      },
    };
    return { api, tickAll };
  }, [frameLoopRef, optsRef]);

  useInsertionEffect(() => {
    tickAllRef.current = tickAll;
  }, [tickAll]);

  // StrictMode-safe cleanup: when the component unmounts (including the
  // dev-mode double-mount that StrictMode performs), cancel every running
  // animation and stop the RAF loop. Without this, the FIRST mount's
  // animator keeps ticking with stale callbacks pointing at the unmounted
  // adapter, while the SECOND mount creates its own animator on top —
  // visible to the user as every animation playing twice.
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
