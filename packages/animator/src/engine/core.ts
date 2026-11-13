import type { ColorOverrideRegistry } from '../colorRegistry';
import type { TrimOverrideRegistry } from '../trimRegistry';
import { AnimatorEventHub } from '../observe';
import type { Behind, TargetState } from '../target';
import type { Animator } from '../types';
import { createAnimatorApi } from './animatorApi';
import { createCodec } from './codec';
import type { ActiveAnimation, AnimationContext } from './context';
import { createFrame, type AnimatorClock } from './frame';
import { createHandoffs } from './handoff/handoffs';
import { createTargetBook } from './offsets';
import { createTable } from './table';
import { createEmitter } from '@weasel-js/registry';

/** What {@link createAnimatorCore} needs of whoever hosts it: a clock and a frame loop. */
export interface CoreHost {
  /** Now, on the clock the frame loop's timestamps are on. */
  now(): number;
  requestFrame(): void;
  cancelFrame(): void;
  /** True once the host has unmounted; logs the first time. */
  tripwire(): boolean;
  /** Now on the document timeline, which `Element.animate` runs on. Default: its current time,
   *  else `performance.now()`. */
  wall?(): number;
  colorOverrides: ColorOverrideRegistry;
  trimOverrides: TrimOverrideRegistry;
}

/** An animator apart from React: its table, clock, and codec, driven by the host's frames. */
export interface AnimatorCore {
  api: Animator;
  /** Runs one frame at timestamp `t`. */
  tick(t: number): void;
  /** Runs one frame at time `t` of an outside clock, which may have gone back since the last:
   *  the animations then play backward over the difference, as under a negative time scale.
   *  `rate` is the clock's, which sets the direction when it has not moved. `wall` is the
   *  frame's time on the document timeline, where the host has it. */
  follow(t: number, rate: number, wall?: number): void;
  /** Says the frame loop stops for time nobody will see, which is charged to no animation. */
  suspended(): void;
  /** Says the frame loop is back after time unseen, which is charged to no animation. */
  resumed(): void;
}

export function createAnimatorCore(host: CoreHost): AnimatorCore {
  const clock: AnimatorClock = { frameT: null, elapsed: 0, timeScale: 1, paused: false, drive: 1 };
  const hub = new AnimatorEventHub();
  const codec = createCodec((on) => {
    // A move behind a row's holds runs in its table's lane for moves; the rest of a row's voices
    // run in its table's lane.
    if ('move' in on) return (on as Behind).move?.place;
    const { row } = on as TargetState;
    return row ? { group: row.table, tag: row.index } : undefined;
  });
  const afterTicks: (() => void)[] = [];
  const subscribers = createEmitter();
  let nextId = 1;
  let atEnd = false;
  const pacing = createPacing(clock, host.wall ?? defaultWall, host.now, () => !frame.framing() && !table.awake && handoffs.any());
  const seedClock = (): void => { if (clock.frameT == null) { clock.frameT = host.now(); pacing.seeded(); } };

  /** Targets whose holds a tick touched, folded again once the frame's ticks are done. */
  const touched = new Set<TargetState>();
  const refold = (s: TargetState): void => {
    if (s.holds) s.holds.store.refold(s.holds.row);
    // Between frames a table's `shown` is read apart for such a row; a frame's pass shows it.
    if (s.row && !frame.framing()) s.row.table.mark(s.row.index);
  };
  const refoldTouched = (): void => {
    for (const s of touched) refold(s);
    touched.clear();
  };
  const table = createTable({
    codec,
    hub,
    elapsed: () => pacing.host.elapsed(),
    direction: () => (clock.timeScale * clock.drive < 0 ? -1 : 1),
    seedClock,
    showNow: (target) => targets.showNow(target),
    resting: () => targets.resting,
    framing: () => frame.framing(),
    requestFrame: host.requestFrame,
  });
  const targets = createTargetBook({
    stop: (s) => {
      for (const a of [...table.on(s)]) table.retire(a.id);
      for (const part of [...s.parts]) part();
    },
    columns: (table) => codec.columns(table),
  });
  const frame = createFrame({
    clock, table, codec, targets, hub, afterTicks, subscribers, refold: refoldTouched,
    afterShow: () => handoffs.frame(), keepsTime: () => handoffs.any(), requestFrame: host.requestFrame, tripwire: host.tripwire,
  });

  const ctx: AnimationContext = {
    codec,
    targets,
    nextId: () => nextId++,
    atEnd: () => atEnd,
    starting: (end, start) => {
      const was = atEnd;
      atEnd = end;
      try { return start(); } finally { atEnd = was; }
    },
    seedClock,
    register: table.register,
    has: (id) => table.animations.has(id),
    defer: table.defer,
    reportEnd: table.reportEnd,
    finish: table.finish,
    touch: (target, at) => {
      if (frame.framing() && !at) { touched.add(target); return; }
      touched.delete(target);
      refold(target);
      if (!frame.framing()) host.requestFrame();
    },
    wake: () => { if (!frame.framing()) host.requestFrame(); },
    tripwire: host.tripwire,
    interrupt: (key, by) => table.cancelByKey(key, by as ActiveAnimation),
    velocityUnder: (key, target) => {
      let sum: number[] | null = null;
      for (const a of table.under(key)) {
        if (a.target !== target) continue;
        const v = a.velocity?.() ?? codec.own(a.id)?.velocity;
        if (v) sum = sum ? sum.map((x, i) => x + v[i]!) : v.slice();
      }
      return sum;
    },
  };

  const handoffs = createHandoffs({ ctx, table, ...pacing.host });
  const api = createAnimatorApi({
    ctx,
    handoffs,
    table,
    clock,
    hub,
    ticking: frame.ticking, framing: frame.framing,
    afterTicks: (cb) => { afterTicks.push(cb); },
    subscribers,
    colorOverrides: host.colorOverrides,
    trimOverrides: host.trimOverrides,
    halt: host.cancelFrame,
  });

  return {
    api,
    tick(t) { checkFrame(t, 1); pacing.outside.on = false; frame.tick(t); },
    follow(t, rate, wall) {
      checkFrame(t, rate); pacing.follow(rate, wall);
      const moved = clock.frameT == null ? 0 : t - clock.frameT;
      const drive = moved < 0 || (moved === 0 && rate < 0) ? -1 : 1;
      if (drive !== clock.drive) table.turn(() => { clock.drive = drive; });
      frame.tick(t);
    },
    suspended: pacing.suspend,
    resumed() {
      pacing.resume();
      handoffs.resumed();
      if (handoffs.any()) host.requestFrame();
    },
  };
}

/** Refused before the frame starts: a NaN time is kept as the last frame's, and every frame
 *  after it advances by NaN. */
function checkFrame(t: number, rate: number): void {
  if (!Number.isFinite(t) || !Number.isFinite(rate)) {
    throw new RangeError(`animator: a frame runs at a finite time and rate, not ${t} at ${rate}`);
  }
}

/** Where the animator's clock stands against the document timeline, by which a run handed to the
 *  compositor is placed: the wall time its clock reads at, and how fast it runs against the wall. */
function createPacing(clock: AnimatorClock, wallNow: () => number, now: () => number, asleep: () => boolean) {
  /** Whether an outside clock drives the frames, at what rate, and the wall time of its last. */
  const outside = { on: false, rate: 1, wall: 0 };
  /** Between `suspend` and `resume`, when the clock counts nothing. */
  let unseen = false;
  const pacing = {
    outside,
    /** The animator's clock now. Runs handed to the compositor ask for no frames, so while only
     *  they run (`asleep`), the time since the last frame is counted as it is read. */
    current(): number {
      if (clock.frameT == null || outside.on || unseen || !asleep()) return clock.elapsed;
      const t = now();
      if (t > clock.frameT) {
        clock.elapsed += (t - clock.frameT) * (clock.paused ? 0 : Math.abs(clock.timeScale));
        clock.frameT = t;
      }
      return clock.elapsed;
    },
    host: {
      pace: () => (clock.paused ? 0 : Math.abs(clock.timeScale) * (outside.on ? Math.abs(outside.rate) : 1)),
      wall: () => (outside.on ? outside.wall : clock.frameT ?? wallNow()),
      elapsed: (): number => pacing.current(),
    },
    follow(rate: number, wall: number | undefined): void {
      outside.on = true;
      outside.rate = rate;
      outside.wall = wall ?? wallNow();
    },
    /** The clock was seeded from idle. */
    seeded(): void { if (outside.on) outside.wall = wallNow(); },
    /** The frame loop stops unseen. Runs on the compositor ask for no frames, so the clock has
     *  counted only to its last read. */
    suspend(): void {
      pacing.current();
      unseen = true;
    },
    /** An hour spent hidden is not an hour the animation ran: dropping the last frame's
     *  timestamp makes the resuming frame advance the clock by nothing. That frame has to be
     *  asked for where only runs on the compositor play, which ask for none. */
    resume(): void {
      unseen = false;
      clock.frameT = null;
    },
  };
  return pacing;
}

function defaultWall(): number {
  const doc = (globalThis as { document?: { timeline?: { currentTime?: unknown } } }).document;
  const t = doc?.timeline?.currentTime;
  return typeof t === 'number' ? t : performance.now();
}
