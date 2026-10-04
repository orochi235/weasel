import { useCallback, useEffect, useInsertionEffect, useMemo, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import { useVisibleRaf } from '../scheduling/useVisibleRaf';
import { easeOut, SPRING_PRESETS, resolveEasing } from '@weasel-js/geom';
import { createLoop, createTweenLoop } from './loop';
import { stepSpring } from './engine/integrator';
import { createDriver } from './engine/driver';
import { axesOf } from './engine/axes';
import { createStagger, type StaggerTimers } from './stagger';
import { createTimeline } from './timeline/createTimeline';
import { ColorOverrideRegistry } from './colorRegistry';
import { AnimatorEventHub } from './observe';
import type { Supervisor, SupervisorOptions, WatchCompletion } from './supervisor';
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
  UseAnimatorOptions,
  LiveAnimation,
} from './types';
import type { TimelineOptions } from './timeline/types';

interface ActiveAnimation {
  id: number;
  kind: AnimationKind;
  cancelKey?: string;
  label?: string;
  /** Built the first time something reports on this entry, then shared. */
  info?: AnimationInfo;
  /** 0–1 where the animation has an end to measure against. */
  progress?(virtualNow: number): number;
  /** Its `end` is reported, though the entry stays on the table until the
   *  frame's ticks are done. */
  ended?: boolean;
  paused: boolean;
  timeScale: number;
  virtualNow: number;
  lastRealNow: number | null;
  /** Returns true when finished. Called once per frame with the current
   *  virtual-ms timestamp and the effective scale it advanced at this frame. */
  tick(virtualNow: number, scale: number): boolean;
  /** Called when the animation is cancelled. Skips onDone. */
  onCancel?(): void;
}

function resolveSpringConstants(o: { preset?: string; stiffness?: number; damping?: number; mass?: number }) {
  const preset = o.preset ? SPRING_PRESETS[o.preset as keyof typeof SPRING_PRESETS] : null;
  return {
    stiffness: o.stiffness ?? preset?.stiffness ?? 170,
    damping: o.damping ?? preset?.damping ?? 26,
    mass: o.mass ?? preset?.mass ?? 1,
  };
}

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
  /** The timestamp the driver last advanced to. Null after the page was hidden and while nothing
   *  runs, so neither gap is charged to the driver; a tween starting then seeds it from `now()`. */
  const driverFrameT = useRef<number | null>(null);
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
        driverFrameT.current = null;
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
    // Resolved timer pair, snapshotted lazily from optsRef on each call so a
    // test that updates the injection after mount still wins. Kept internal —
    // not exposed on the public Animator surface; passed directly into
    // `createStagger` at bind time below.
    const staggerTimers: StaggerTimers = {
      setTimer: (cb, ms) =>
        (optsRef.current.setTimer ?? ((c, m) => setTimeout(c, m)))(cb, ms),
      clearTimer: (h) =>
        (optsRef.current.clearTimer ??
          ((x) => clearTimeout(x as ReturnType<typeof setTimeout>)))(h),
      now,
    };

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
    const driver = createDriver();
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
     *  the animation claiming its key. */
    const retire = (id: number, by?: ActiveAnimation): void => {
      const a = animations.current.get(id);
      if (!a) return;
      a.onCancel?.();
      driver.stop(id);
      animations.current.delete(id);
      fireCompletion(id);
      if (!hub.watched || a.ended) return;
      hub.emit(by
        ? { type: 'interrupt', animation: infoOf(a), by: infoOf(by) }
        : { type: 'cancel', animation: infoOf(a) });
    };

    const tickAll = (t: number): void => {
      const finished: ActiveAnimation[] = [];
      const frameDt = driverFrameT.current == null ? 0 : Math.max(0, t - driverFrameT.current);
      driverFrameT.current = t;
      driver.frame(frameDt * (globalPaused.current ? 0 : globalTimeScale.current));
      for (const anim of animations.current.values()) {
        // `t` comes from the frame clock; `lastRealNow` is seeded at register()
        // from `now()`. The two share a time origin in a browser, where the rAF
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
        } finally {
          tickDepth.current -= 1;
        }
      }
      for (const anim of finished) {
        // Gone already if its own tick canceled it; replaced if something
        // revived it under the same id since.
        if (animations.current.get(anim.id) !== anim) continue;
        reportEnd(anim.id);
        animations.current.delete(anim.id);
        fireCompletion(anim.id);
      }
      // Notify every onTick subscriber AFTER the tick batch so they
      // see the latest `colorOverrides` / pose values. Errors in one
      // subscriber don't suppress the others.
      for (const sub of tickSubscribers.current) {
        try { sub(); } catch (err) { console.error('useAnimator: onTick subscriber threw', err); }
      }
      if (animations.current.size > 0) frameLoopRef.current.request();
      else driverFrameT.current = null;
    };

    const ensureLoop = (): void => {
      if (animations.current.size === 0) return;
      frameLoopRef.current.request();
    };

    const cancelByKey = (key: string, by?: ActiveAnimation): void => {
      const ids: number[] = [];
      for (const anim of animations.current.values()) {
        if (anim.cancelKey === key) ids.push(anim.id);
      }
      for (const id of ids) retire(id, by);
    };

    type AnimationSeed =
      Omit<ActiveAnimation, 'paused' | 'timeScale' | 'virtualNow' | 'lastRealNow'>
      & {
        /** Registers under an existing `cancelKey` without cancelling whoever
         *  holds it. For an animation re-registering itself — a revived
         *  timeline — which is not a new claim on the key. */
        keepExisting?: boolean;
      };
    /** Gives a driver subject the rate its own pause and time scale now ask for. */
    const rateOf = (a: ActiveAnimation): void => {
      if (driver.has(a.id)) driver.rate(a.id, a.paused ? 0 : a.timeScale);
    };

    const register = (seed: AnimationSeed): AnimationHandle => {
      const anim = seed as ActiveAnimation;
      if (seed.cancelKey != null && !seed.keepExisting) cancelByKey(seed.cancelKey, anim);
      anim.paused = false;
      anim.timeScale = 1;
      anim.virtualNow = 0;
      // Seed lastRealNow at registration so the first frame's realDt reflects
      // the gap between register() and the first RAF callback: it places a
      // tween's end, and gives spring/decay a non-zero first dt sample.
      anim.lastRealNow = now();
      animations.current.set(anim.id, anim);
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

    // Supervisor: a registered animation whose tick is a no-op (never
    // finishes naturally) so loop/stagger can sit in the animator's id table
    // and benefit from `cancel`/`cancelKey`/`isActive`. The owning composite
    // (loop/stagger) installs an onCancel to actually tear down its children.
    const createSupervisor = ({ kind, cancelKey, label }: SupervisorOptions): Supervisor => {
      const id = nextId.current++;
      let onCancelCb: (() => void) | undefined;
      const base = register({
        id,
        kind,
        cancelKey,
        label,
        // tick is a no-op: the supervisor only ends when the owner calls
        // `cancel()` (either via animator.cancel, animator.cancelKey, or the
        // composite's natural-completion path which forwards to `cancel`).
        tick: () => false,
        onCancel: () => onCancelCb?.(),
      });
      return {
        id: base.id,
        cancel: base.cancel,
        pause: base.pause,
        resume: base.resume,
        setTimeScale: base.setTimeScale,
        timeScale: base.timeScale,
        isPaused: base.isPaused,
        setOnCancel: (cb) => { onCancelCb = cb; },
        finish: () => {
          if (!animations.current.has(id)) return;
          reportEnd(id);
          animations.current.delete(id);
          fireCompletion(id);
        },
        cancelKey,
      };
    };

    const tween = <T,>(o: TweenOptions<T>): AnimationHandle => {
      // blits blends in a straight line, which a caller's own function may not do.
      const fromAxes = o.interpolate || o.interpolator ? null : axesOf(o.from);
      const toAxes = fromAxes && axesOf(o.to);
      const axes = fromAxes && toAxes && toAxes.shape === fromAxes.shape ? fromAxes : null;
      // Refused here rather than on a tick, where a throw would stop every other animation.
      if (!axes && !o.interpolate && !o.interpolator) {
        throw new Error('tween: interpolate or interpolator is required for non-numeric T');
      }
      const id = nextId.current++;
      const easing = resolveEasing(o.easing ?? easeOut);
      // Precedence: factory > per-tick. Factory is built once at tween start so
      // expensive setup (color space conversion etc.) doesn't repeat per frame.
      const factoryFn = o.interpolator ? o.interpolator(o.from, o.to) : null;
      let lastValueEmitted = false;
      // Seeds the driver's clock where `register` seeds the call's, so both charge the same wait.
      if (driverFrameT.current == null) driverFrameT.current = now();
      // Started ahead of `register`, whose `start` listeners may already cancel it.
      driver.tween({
        id, ms: Math.max(o.ms, 1), ease: easing,
        from: axes ? axes.to(o.from) : [0],
        to: axes ? axes.to(o.to) : [1],
      });
      return register({
        id,
        kind: 'tween',
        cancelKey: o.cancelKey,
        label: o.label,
        progress: (virtualNow) => (o.ms <= 0 ? 1 : Math.min(1, virtualNow / o.ms)),
        // `nowMs` is the call's own virtual time, so it still decides when the tween ends; the driver
        // supplies only the value in between.
        tick(nowMs) {
          if (tripwire()) { driver.stop(id); return true; }
          const t = o.ms <= 0 ? 1 : Math.min(1, nowMs / o.ms);
          let value: T;
          if (axes) {
            value = t >= 1 ? o.to : axes.from(driver.column(id), driver.offset(id));
          } else {
            const eased = t >= 1 ? easing(1) : driver.column(id)[driver.offset(id)]!;
            value = factoryFn ? factoryFn(eased) : o.interpolate!(o.from, o.to, eased);
          }
          o.onTick(value);
          if (t >= 1 && !lastValueEmitted) {
            lastValueEmitted = true;
            driver.stop(id);
            // That last onTick may have cancelled us — deregistering the id.
            // A cancelled tween never completes, whenever the cancel landed.
            if (animations.current.has(id)) {
              reportEnd(id);
              o.onDone?.();
            }
            return true;
          }
          return false;
        },
      });
    };

    const physics = <T,>(o: PhysicsOptions<T>, kind: AnimationKind = 'physics'): PhysicsHandle<T> => {
      const id = nextId.current++;
      const isNumeric = typeof o.from === 'number';
      if (!isNumeric && (!o.add || !o.subtract || !o.scale || !o.magnitude)) {
        throw new Error('physics: add/subtract/scale/magnitude are required for non-numeric T');
      }
      const add = o.add ?? ((a: T, b: T) => ((a as unknown as number) + (b as unknown as number)) as unknown as T);
      const subtract = o.subtract ?? ((a: T, b: T) => ((a as unknown as number) - (b as unknown as number)) as unknown as T);
      const scale = o.scale ?? ((v: T, k: number) => ((v as unknown as number) * k) as unknown as T);
      const magnitude = o.magnitude ?? ((v: T) => Math.abs(v as unknown as number));
      const { stiffness: kBase, damping, mass } = resolveSpringConstants(o);
      const restThreshold = o.restThreshold ?? 0.01;

      let target: T | null = o.to ?? null;
      let value = o.from;
      // Default to zero velocity: assumes scale(_, 0) returns the zero vector of T. Pass an explicit velocity for unusual T where this isn't true.
      let velocity: T = o.velocity ?? scale(o.from, 0);
      let lastTime: number | null = null;

      // blits' closed forms need positive damping and mass, and a spring with a target needs
      // stiffness; decay's handle never takes a target.
      const solvable = damping > 0 && mass > 0 && (kBase > 0 || kind === 'decay');
      const fromAxes = solvable ? axesOf(o.from) : null;
      const sameShape = (v: T | null | undefined): boolean => v == null || axesOf(v)?.shape === fromAxes!.shape;
      const axes = fromAxes && sameShape(o.to) && sameShape(o.velocity) ? fromAxes : null;
      if (axes) {
        // Seeds the driver's clock where `register` seeds the call's, so both charge the same wait.
        if (driverFrameT.current == null) driverFrameT.current = now();
        // Started ahead of `register`, whose `start` listeners may already cancel it.
        driver.spring({
          id, axes: axes.count,
          from: axes.to(o.from),
          to: o.to == null ? null : axes.to(o.to),
          velocity: o.velocity == null ? new Array<number>(axes.count).fill(0) : axes.to(o.velocity),
          stiffness: kBase, damping, mass,
        });
      }

      const baseHandle = register({
        id,
        kind,
        cancelKey: o.cancelKey,
        label: o.label,
        tick(nowMs) {
          if (tripwire()) { driver.stop(id); return true; }
          if (lastTime == null) {
            lastTime = nowMs;
            // Already-at-rest short-circuit: decay-mode (target == null)
            // with starting velocity below threshold should complete
            // immediately rather than emit a tick and wait a frame.
            if (target == null && magnitude(velocity) < restThreshold) {
              driver.stop(id);
              reportEnd(id);
              o.onDone?.();
              return true;
            }
            o.onTick(value);
            return false;
          }
          if (axes) {
            const m = driver.motion(id);
            value = axes.from(m.value);
            velocity = axes.from(m.velocity);
          } else {
            // Semi-implicit Euler, for a T blits cannot move as axes.
            const dt = Math.min(0.064, (nowMs - lastTime) / 1000);
            const next = stepSpring({ add, subtract, scale }, value, velocity, target, kBase, damping, mass, dt);
            value = next.value;
            velocity = next.velocity;
          }
          lastTime = nowMs;
          o.onTick(value);
          const velRested = magnitude(velocity) < restThreshold;
          const posRested = target == null
            ? true
            : magnitude(subtract(value, target)) < restThreshold;
          if (velRested && posRested) {
            if (target != null) o.onTick(target);
            driver.stop(id);
            reportEnd(id);
            o.onDone?.();
            return true;
          }
          return false;
        },
      });

      const checkShape = (v: T, what: string): void => {
        if (!sameShape(v)) throw new Error(`physics: ${what} is not the same shape as \`from\``);
      };
      const handle: PhysicsHandle<T> = {
        ...baseHandle,
        setTarget: (newTo: T | null) => {
          if (axes && newTo != null) checkShape(newTo, 'setTarget');
          target = newTo;
          if (axes && driver.has(id)) driver.retarget(id, newTo == null ? null : axes.to(newTo));
        },
        setVelocity: (v: T) => {
          if (axes) checkShape(v, 'setVelocity');
          velocity = v;
          if (axes && driver.has(id)) driver.push(id, axes.to(v));
        },
      };
      return handle;
    };

    const spring = <T,>(o: SpringOptions<T>): AnimationHandle => physics<T>(o, 'spring');

    const decay = <T,>(o: DecayOptions<T>): AnimationHandle => {
      const friction = o.friction ?? 0.95;
      // Per-second friction v(t) = v0 * friction^t corresponds to
      // m*dv/dt = -c*v with c = -ln(friction), m = 1, k = 0.
      const damping = -Math.log(friction);
      return physics<T>({
        from: o.from,
        to: null,
        velocity: o.velocity,
        stiffness: 0,
        damping,
        mass: 1,
        restThreshold: o.threshold ?? 0.5,
        add: o.add,
        // DecayOptions doesn't carry subtract; derive from add+scale.
        subtract: (a, b) => o.add(a, o.scale(b, -1)),
        scale: o.scale,
        magnitude: o.magnitude,
        onTick: o.onTick,
        onDone: o.onDone,
        cancelKey: o.cancelKey,
        label: o.label,
      }, 'decay');
    };

    const cancelAll = (): void => {
      const retired: ActiveAnimation[] = [];
      for (const a of animations.current.values()) {
        a.onCancel?.();
        driver.stop(a.id);
        retired.push(a);
      }
      animations.current.clear();
      driverFrameT.current = null;
      for (const a of retired) fireCompletion(a.id);
      if (hub.watched) for (const a of retired) hub.emit({ type: 'cancel', animation: infoOf(a) });
      frameLoopRef.current.cancel();
    };
    const api: Animator = {
      tween,
      spring,
      decay,
      physics,
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
          staggerTimers,
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
        });
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
