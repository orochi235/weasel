import type { ColorOverrideRegistry } from '../colorRegistry';
import { createLoop, createTweenLoop } from '../loop';
import type { AnimatorEventHub } from '../observe';
import { createStagger } from '../stagger';
import { supervisors } from '../supervisor';
import { stateOf } from '../target';
import { createTimeline } from '../timeline/createTimeline';
import type { OpenTrackHold } from '../timeline/trackHolds';
import type { TimelineOptions } from '../timeline/types';
import type {
  AnimationHandle, AnimationInfo, AnimationKind, Animator, DecayOptions, LiveAnimation, PhysicsHandle,
  PhysicsOptions, SpringOptions, TargetDecayOptions, TargetPhysicsOptions, TargetSpringOptions,
  TargetTweenOptions, TweenOptions,
} from '../types';
import type { ActiveAnimation, AnimationContext } from './context';
import { decayAsPhysics } from './decay';
import type { AnimatorClock } from './frame';
import { startHold } from './holdAnimation';
import { startHoldRows } from './holdRows';
import { openHold } from './holds';
import { startOffsetPhysics } from './offsetPhysics';
import { startOffsetTween } from './offsetTween';
import { startPhysics } from './physicsAnimation';
import { timeScaleOf, type Table } from './table';
import { startTween } from './tweenAnimation';
import type { Emitter } from '@weasel-js/registry';

/** What {@link createAnimatorApi} needs of the animator around it. */
export interface ApiHost {
  ctx: AnimationContext;
  table: Table;
  clock: AnimatorClock;
  hub: AnimatorEventHub;
  /** Whether an animation's own tick is running. */
  ticking(): boolean;
  /** Runs a callback once the frame's ticks are done. */
  afterTicks(cb: () => void): void;
  subscribers: Pick<Emitter, 'subscribe'>;
  colorOverrides: ColorOverrideRegistry;
  /** Stops the frame loop, once everything is canceled and its targets are shown at rest. */
  halt(): void;
}

/** Gives every animation holding `key` the pause and time scale `pace` answers for it. */
function eachUnder(
  table: Table, key: string, pace: (a: ActiveAnimation) => [paused: boolean, timeScale: number],
): void {
  for (const a of table.under(key)) table.pace(a, ...pace(a));
}

function liveRows(table: Table): LiveAnimation[] {
  const rows: LiveAnimation[] = [];
  for (const a of table.animations.values()) {
    rows.push({
      ...table.infoOf(a),
      paused: a.paused,
      timeScale: a.timeScale,
      elapsed: table.clockOf(a),
      ...(a.progress ? { progress: a.progress(table.clockOf(a)) } : {}),
    });
  }
  return rows;
}

function startTimeline(host: ApiHost, o: TimelineOptions): ReturnType<Animator['timeline']> {
  const { ctx, table, hub } = host;
  const id = ctx.nextId();
  const info = (): AnimationInfo | undefined => {
    const a = table.animations.get(id);
    return a && table.infoOf(a);
  };
  const hold: OpenTrackHold = (target, value, weight, axes, fixed) =>
    openHold(ctx, { target: stateOf(target), value, weight, axes, fixed });
  return createTimeline(table.register, id, o, {
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
}

/** The animator's public surface over its table, clock, and primitives. */
export function createAnimatorApi(host: ApiHost): Animator {
  const { ctx, table, clock, hub } = host;
  const { animations } = table;
  const createSupervisor = supervisors({
    nextId: ctx.nextId,
    atEnd: ctx.atEnd,
    starting: ctx.starting,
    register: table.register,
    finish: table.finish,
    afterTicks: host.afterTicks,
    rateOf: (id) => {
      const a = animations.get(id);
      return a ? table.rateOf(a) : 0;
    },
  });

  const physics = <T,>(
    o: PhysicsOptions<T> | TargetPhysicsOptions<T>,
    kind: AnimationKind = 'physics',
  ): PhysicsHandle<T> => (o.target ? startOffsetPhysics(ctx, o, kind) : startPhysics(ctx, o, kind));

  const api: Animator = {
    tween: <T,>(o: TweenOptions<T> | TargetTweenOptions<T>): AnimationHandle =>
      (o.target ? startOffsetTween(ctx, o) : startTween(ctx, o)),
    spring: <T,>(o: SpringOptions<T> | TargetSpringOptions<T>): AnimationHandle => physics<T>(o, 'spring'),
    decay: <T,>(o: DecayOptions<T> | TargetDecayOptions<T>): AnimationHandle =>
      physics<T>(decayAsPhysics(o), 'decay'),
    physics,
    hold: (o) => startHold(ctx, o),
    holdRows: (o) => startHoldRows(ctx, o),
    cancel: (handle) => table.retire(handle.id),
    cancelKey: (key) => table.cancelByKey(key),
    cancelAll: () => {
      table.cancelAll(() => {
        clock.frameT = null;
        ctx.targets.show();
      });
      host.halt();
    },
    isActive: (key) => {
      if (key == null) return animations.size > 0;
      for (const _ of table.under(key)) return true;
      return false;
    },
    isTicking: host.ticking,
    pause: () => { clock.paused = true; },
    resume: () => { clock.paused = false; },
    isPaused: () => clock.paused,
    setTimeScale: (s) => {
      const scale = timeScaleOf(s);
      if ((scale < 0) === (clock.timeScale < 0)) clock.timeScale = scale;
      else table.turn(() => { clock.timeScale = scale; });
    },
    timeScale: () => clock.timeScale,
    pauseKey: (key) => eachUnder(table, key, (a) => [true, a.timeScale]),
    resumeKey: (key) => eachUnder(table, key, (a) => [false, a.timeScale]),
    setTimeScaleByKey: (key, s) => {
      const scale = timeScaleOf(s);
      eachUnder(table, key, (a) => [a.paused, scale]);
    },
    loop: (factory, loopOpts) => createLoop(createSupervisor, factory, loopOpts),
    tweenLoop: (tweenLoopOpts) => createTweenLoop(api, createSupervisor, tweenLoopOpts),
    stagger: ((items, delay, factory, staggerOpts) =>
      createStagger(
        api,
        createSupervisor,
        table.watchCompletion,
        items,
        delay,
        factory as never,
        staggerOpts,
      )) as Animator['stagger'],
    timeline: (o: TimelineOptions) => startTimeline(host, o),
    colorOverrides: host.colorOverrides,
    onTick: (cb) => host.subscribers.subscribe(cb),
    keepAlive: () => {
      const sup = createSupervisor({ kind: 'keepAlive' });
      return () => sup.cancel();
    },
    watch: (listener) => hub.add(listener),
    live: () => liveRows(table),
  };
  return api;
}
