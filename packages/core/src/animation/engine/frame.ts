import type { AnimatorEventHub } from '../observe';
import type { Codec } from './codec';
import type { ActiveAnimation } from './context';
import type { TargetBook } from './offsets';
import type { Table } from './table';

/** The animator's clock: where its frames stand, and how fast they run. */
export interface AnimatorClock {
  /** The timestamp the codec last advanced to. Null after the page was hidden and while nothing
   *  runs, so neither gap is charged to the codec; a tween starting then seeds it from `now()`. */
  frameT: number | null;
  timeScale: number;
  paused: boolean;
}

/** What {@link createFrame} needs of the animator around it. */
export interface FrameHost {
  clock: AnimatorClock;
  table: Pick<Table, 'animations' | 'retire' | 'reportEnd' | 'finish' | 'drop' | 'infoOf'>;
  codec: Pick<Codec, 'frame'>;
  targets: Pick<TargetBook, 'settle' | 'show'>;
  hub: AnimatorEventHub;
  /** Supervisor frame callbacks due this frame, run once its ticks are done. */
  afterTicks: (() => void)[];
  /** Told once a frame, after its ticks and its targets are shown. */
  subscribers: ReadonlySet<() => void>;
  /** Reads each touched target's voices again. */
  reread(): void;
  requestFrame(): void;
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

  /** Ticks every animation on the table as the frame began, and answers which finished. */
  const tickEach = (t: number): ActiveAnimation[] => {
    const finished: ActiveAnimation[] = [];
    const threw: [ActiveAnimation, unknown][] = [];
    // A snapshot: an animation registered by this frame's ticks first ticks on the
    // next, or a zero-duration loop would chain inside one frame and never leave it.
    for (const anim of [...animations.values()]) {
      if (animations.get(anim.id) !== anim) continue;
      // `t` comes from the frame clock; `lastRealNow` is seeded at register()
      // from `now()` while the animator is idle. The two share a time origin in a browser, where the rAF
      // timestamp and `performance.now()` are both page-relative — but not
      // everywhere: jsdom starts them ~600ms apart, which made the first
      // frame's delta hugely negative and left `virtualNow` climbing back
      // toward zero for dozens of frames before a tween advanced at all.
      // Time never runs backwards, so a negative sample is never real.
      const realDt = anim.lastRealNow == null ? 0 : Math.max(0, t - anim.lastRealNow);
      anim.lastRealNow = t;
      const scale = clock.paused ? 0 : clock.timeScale * (anim.paused ? 0 : anim.timeScale);
      anim.virtualNow += realDt * scale;
      tickDepth += 1;
      try {
        if (anim.tick(anim.virtualNow, scale)) finished.push(anim);
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

  const awake = (): boolean => {
    for (const a of animations.values()) if (!a.idle) return true;
    return false;
  };

  return {
    tick(t) {
      const frameDt = clock.frameT == null ? 0 : Math.max(0, t - clock.frameT);
      clock.frameT = t;
      framing = true;
      host.codec.frame(frameDt * (clock.paused ? 0 : clock.timeScale));
      host.targets.settle();
      for (const anim of tickEach(t)) {
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
      // An error in one does not suppress the others.
      for (const sub of host.subscribers) {
        try { sub(); } catch (err) { console.error('useAnimator: onTick subscriber threw', err); }
      }
      if (awake()) {
        host.requestFrame();
        return;
      }
      // As when the page was hidden: the time asleep is charged to nothing.
      clock.frameT = null;
      for (const anim of animations.values()) anim.lastRealNow = null;
    },
    framing: () => framing,
    ticking: () => tickDepth > 0,
  };
}
