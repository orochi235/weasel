import type { AnimatorEventHub } from '../observe';
import type { Codec } from './codec';
import type { ActiveAnimation } from './context';
import type { TargetBook } from './offsets';
import type { Table } from './table';
import type { Emitter } from '@weasel-js/registry';

/** The animator's clock: where its frames stand, and how fast they run. */
export interface AnimatorClock {
  /** The timestamp the codec last advanced to. Null after the page was hidden and while nothing
   *  runs, so neither gap is charged to the codec; a tween starting then seeds it from `now()`. */
  frameT: number | null;
  /** The virtual ms its frames have advanced it by: each animation's own clock is read off it. */
  elapsed: number;
  timeScale: number;
  paused: boolean;
}

/** What {@link createFrame} needs of the animator around it. */
export interface FrameHost {
  clock: AnimatorClock;
  table: Pick<
    Table,
    'animations' | 'retire' | 'reportEnd' | 'finish' | 'drop' | 'infoOf' | 'ticks' | 'clockOf' | 'awake' | 'waiting'
  >;
  codec: Pick<Codec, 'frame'>;
  targets: Pick<TargetBook, 'settle' | 'show'>;
  hub: AnimatorEventHub;
  /** Supervisor frame callbacks due this frame, run once its ticks are done. */
  afterTicks: (() => void)[];
  /** Told once a frame, after its ticks and its targets are shown. */
  subscribers: Pick<Emitter, 'emit'>;
  /** Reads each touched target's voices again. */
  reread(): void;
  requestFrame(): void;
  /** True once the host has unmounted; logs the first time. */
  tripwire(): boolean;
}

export interface Frame {
  /** Runs one frame at timestamp `t`. */
  tick(t: number): void;
  /** Whether a frame is between reading the codec and showing its targets. */
  framing(): boolean;
  /** Whether an animation's own tick is running. */
  ticking(): boolean;
}

export function createFrame(host: FrameHost): Frame {
  const { clock, table, hub } = host;
  const { animations } = table;
  let framing = false;
  // Counted around each animation's tick, so a re-entrant call (`decay.onTick` to
  // `adapter.setPose` to `animateOnSetPose`) can tell it is inside one and write through
  // rather than schedule a tween that would fight the caller.
  let tickDepth = 0;

  /** Ticks the animations with something to do this frame, as the table stood when the frame
   *  began, and answers which finished. */
  const tickEach = (): ActiveAnimation[] => {
    const finished: ActiveAnimation[] = [];
    const threw: [ActiveAnimation, unknown][] = [];
    // One waiting for its `due` checks for nothing meanwhile, the host's unmount included:
    // once that has happened every animation is ticked, so each sees it and leaves.
    const all = table.waiting > 0 && host.tripwire();
    // A snapshot: an animation registered by this frame's ticks first ticks on the
    // next, or a zero-duration loop would chain inside one frame and never leave it.
    for (const anim of all ? [...animations.values()] : table.ticks()) {
      if (animations.get(anim.id) !== anim) continue;
      const scale = clock.paused ? 0 : clock.timeScale * (anim.paused ? 0 : anim.timeScale);
      tickDepth += 1;
      try {
        if (anim.tick(table.clockOf(anim), scale)) finished.push(anim);
      } catch (error) {
        threw.push([anim, error]);
      } finally {
        tickDepth -= 1;
      }
    }
    for (const [anim, error] of threw) {
      console.error('useAnimator: animation tick threw; retiring it', error);
      if (animations.get(anim.id) !== anim) continue;
      // One that ended before throwing (from `onDone`) is finished, not canceled.
      if (anim.ended) table.drop(anim);
      else table.retire(anim.id, undefined, true);
      if (hub.watched) hub.emit({ type: 'error', animation: table.infoOf(anim), error });
    }
    return finished;
  };

  return {
    tick(t) {
      // `t` comes from the frame clock, and `frameT` is seeded from `now()` while the animator
      // is idle. The two share a time origin in a browser, where the rAF timestamp and
      // `performance.now()` are both page-relative, but not everywhere: jsdom starts them
      // ~600ms apart. Time never runs backwards, so a negative sample is never real.
      const frameDt = clock.frameT == null ? 0 : Math.max(0, t - clock.frameT);
      clock.frameT = t;
      framing = true;
      // Backward is each animation's own rate: the clock under them only goes forward.
      const dt = frameDt * (clock.paused ? 0 : Math.abs(clock.timeScale));
      clock.elapsed += dt;
      host.codec.frame(dt);
      host.targets.settle();
      for (const anim of tickEach()) {
        // Gone already if its own tick canceled it; replaced if something
        // revived it under the same id since.
        if (animations.get(anim.id) === anim) table.finish(anim.id);
      }
      for (const cb of host.afterTicks.splice(0)) {
        try { cb(); } catch (err) { console.error('useAnimator: a staggered start threw', err); }
      }
      host.reread();
      framing = false;
      host.targets.show();
      // After the tick batch, so each subscriber sees the latest color overrides and poses.
      host.subscribers.emit();
      if (table.awake) {
        host.requestFrame();
        return;
      }
      // As when the page was hidden: the time asleep is charged to nothing.
      clock.frameT = null;
    },
    framing: () => framing,
    ticking: () => tickDepth > 0,
  };
}
