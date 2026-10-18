import type { ColorOverrideRegistry } from '../colorRegistry';
import { AnimatorEventHub } from '../observe';
import type { TargetState } from '../target';
import type { Animator } from '../types';
import { createAnimatorApi } from './animatorApi';
import { createCodec } from './codec';
import type { ActiveAnimation, AnimationContext } from './context';
import { createFrame, type AnimatorClock } from './frame';
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
  colorOverrides: ColorOverrideRegistry;
}

/** An animator apart from React: its table, clock, and codec, driven by the host's frames. */
export interface AnimatorCore {
  api: Animator;
  /** Runs one frame at timestamp `t`. */
  tick(t: number): void;
  /** Says the frame loop is back after time unseen, which is charged to no animation. */
  resumed(): void;
}

export function createAnimatorCore(host: CoreHost): AnimatorCore {
  const clock: AnimatorClock = { frameT: null, elapsed: 0, timeScale: 1, paused: false };
  const hub = new AnimatorEventHub();
  const codec = createCodec((on) => {
    const { row } = on as TargetState;
    return row ? { group: row.table, tag: row.index } : undefined;
  });
  const afterTicks: (() => void)[] = [];
  const subscribers = createEmitter();
  let nextId = 1;
  const seedClock = (): void => { if (clock.frameT == null) clock.frameT = host.now(); };

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
    elapsed: () => clock.elapsed,
    direction: () => (clock.timeScale < 0 ? -1 : 1),
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
    requestFrame: host.requestFrame, tripwire: host.tripwire,
  });

  const ctx: AnimationContext = {
    codec,
    targets,
    nextId: () => nextId++,
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

  const api = createAnimatorApi({
    ctx,
    table,
    clock,
    hub,
    ticking: frame.ticking,
    afterTicks: (cb) => { afterTicks.push(cb); },
    subscribers,
    colorOverrides: host.colorOverrides,
    halt: host.cancelFrame,
  });

  return {
    api,
    tick: frame.tick,
    resumed() {
      // An hour spent hidden is not an hour the animation ran: dropping the last frame's
      // timestamp makes the resuming frame advance the clock by nothing.
      clock.frameT = null;
    },
  };
}
