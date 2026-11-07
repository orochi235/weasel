import type { ElementAnimation } from '../../elementTarget';
import type { AnimationContext } from '../context';
import type { Table } from '../table';

/** What the runs handed to the compositor need of the animator around them. */
export interface HandoffHost {
  ctx: AnimationContext;
  table: Pick<Table, 'animations' | 'clockOf' | 'rateOf' | 'on' | 'retire'>;
  /** Virtual ms the animator's clock runs per wall ms: 0 while it is paused. */
  pace(): number;
  /** The wall time, on the document timeline, at which the animator's clock reads `elapsed()`. */
  wall(): number;
  elapsed(): number;
}

/** A run handed to `Element.animate`, as the animator keeps it in step. */
export interface Placed {
  readonly id: number;
  readonly animation: ElementAnimation;
  /** Its own clock's reading at its motion's start. */
  readonly offset: number;
}

/** The runs one animator has handed to the compositor. */
export interface Handoffs {
  readonly host: HandoffHost;
  /** Whether any run is handed off. */
  any(): boolean;
  add(run: Placed): void;
  remove(run: Placed): void;
  /** Sets `run`'s browser animation to where and how fast its own clock now stands. */
  place(run: Placed): void;
  /** After each frame: places every run again where the animator's clock left the pace the
   *  browser's would have kept, as a seek of an outside clock or a ramp of its rate does. */
  frame(): void;
  /** The animator's own pause or time scale is about to change: the time until now is counted
   *  at the pace that held through it. */
  settle(): void;
  /** The animator's own pause or time scale changed. */
  retime(): void;
  /** The frame loop is back after time unseen, which the browser's timeline counted and the
   *  animator's did not. */
  resumed(): void;
}

/** How far the animator's clock may stray from the browser's before every run is placed again,
 *  in virtual ms. */
const DRIFT_MS = 0.5;

export function createHandoffs(host: HandoffHost): Handoffs {
  const { table } = host;
  const runs = new Set<Placed>();
  let last = { elapsed: 0, wall: 0, pace: 1 };
  let stale = true;

  const place = (run: Placed): void => {
    const a = table.animations.get(run.id);
    if (!a) return;
    const own = table.clockOf(a) - run.offset;
    const rate = table.rateOf(a) * host.pace();
    const { animation } = run;
    if (rate === 0) {
      animation.pause();
      animation.currentTime = own;
      return;
    }
    animation.playbackRate = rate;
    animation.startTime = host.wall() - own / rate;
  };
  const mark = (): void => { last = { elapsed: host.elapsed(), wall: host.wall(), pace: host.pace() }; stale = false; };
  const placeAll = (): void => {
    for (const run of runs) place(run);
    mark();
  };

  return {
    host,
    any: () => runs.size > 0,
    add(run) {
      if (runs.size === 0) mark();
      runs.add(run);
    },
    remove: (run) => { runs.delete(run); },
    place,
    frame() {
      if (runs.size === 0) return;
      const pace = host.pace();
      const predicted = last.elapsed + (host.wall() - last.wall) * last.pace;
      if (stale || pace !== last.pace || Math.abs(host.elapsed() - predicted) > DRIFT_MS) placeAll();
    },
    settle: () => { host.elapsed(); },
    retime: placeAll,
    resumed: () => { stale = true; },
  };
}
