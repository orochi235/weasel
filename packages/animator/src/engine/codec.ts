import {
  cueQueued, cueSpring, joinPath, joinSpring, joinTween, motionOf, ownOf, springMotion, type Voice,
} from './codecVoice';
import { createLanes, type LaneColumns, type LanePlace, type Reader, type Slot } from './lanes';
import { createRewinds } from './rewinds';

export type { Reader } from './lanes';

export interface TweenStart {
  id: number; ms: number; ease: (u: number) => number;
  /** Endpoints as axes. A tween whose caller blends its own values passes [0] and [1]. */
  from: number[]; to: number[];
  /** The subject the voice reaches, where several voices share one. Default: its own, `id`. */
  on?: unknown;
  /** Starts it at its end, to play backward. */
  atEnd?: boolean;
}
export interface SpringStart {
  id: number; axes: number;
  from: number[]; to: number[] | null; velocity: number[];
  stiffness: number; damping: number; mass: number;
  /** As {@link TweenStart.on}. */
  on?: unknown;
}
export interface PathStart {
  id: number; ms: number; axes: number;
  /** The voice's axes at linear progress `u`, 0 to 1. */
  at(u: number): number[];
  /** As {@link TweenStart.on}. */
  on?: unknown;
  /** As {@link TweenStart.atEnd}. */
  atEnd?: boolean;
}
/** A voice's own value and velocity, apart from any other voice on its subject. */
export interface Own { value: number[]; velocity: number[] }
export interface SpringReader extends Reader {
  /** Position and velocity at the last `frame`, for a voice alone on its subject. */
  motion(): Own;
}
export interface Codec {
  /** Advances the codec's clock by `dtMs` of animator time, then reads every subject. */
  frame(dtMs: number): void;
  tween(s: TweenStart): Reader;
  spring(s: SpringStart): SpringReader;
  path(s: PathStart): Reader;
  retarget(id: number, to: number[] | null): void;
  /** Starts spring `id` over from `from` at `velocity`, toward `to` or coasting. */
  recue(id: number, from: number[], velocity: number[], to: number[] | null): void;
  push(id: number, velocity: number[]): void;
  /** Plays `id` at rate `rate` from where it is, without a jump. */
  rate(id: number, rate: number): void;
  /** Whether `id`, played backward, has got back to its start: its subject shows its first
   *  frame from then until it stops. */
  rewound(id: number): boolean;
  stop(id: number): void;
  /** Whether `id` is one of the codec's voices. */
  has(id: number): boolean;
  /** Voice `id`'s own value and velocity as of the last `frame`. */
  own(id: number): Own | undefined;
  /** How many voices the codec is running; for tests and diagnostics. */
  voiceCount(): number;
  /** The lane of `group` as the last frame read it; null where it has none. */
  columns(group: object): LaneColumns | null;
}

/** `placeOf` answers where a shared subject's voices run, for one kept in a lane of its own.
 *  `fault` hears a throw from a voice's own `ease` or `at` as a frame reads it, which then reads
 *  on as linear progress or where the voice last stood; by default the throw goes on. */
export function createCodec(
  placeOf?: (on: object) => LanePlace | undefined,
  fault: (id: number, error: unknown) => void = (_, error) => { throw error; },
): Codec {
  const lanes = createLanes(placeOf);
  const voices = new Map<number, Voice>();
  // Tweens are cued together at the next frame, not one by one as they start: a burst of starts then
  // keeps the caller's objects together rather than each a voice apart, which the frame loop reads.
  const queue: Voice[] = [];
  const rewinds = createRewinds<Voice>();
  let time = 0;

  const get = (id: number): Voice => {
    const v = voices.get(id);
    if (!v) throw new Error(`codec: no subject ${id}`);
    return v;
  };

  const respring = (v: Voice, next: SpringStart): void => {
    const rate = v.handle.rate;
    v.handle.fade({ over: 0 });
    const handle = cueSpring(v.slot, next);
    handle.rate = rate;
    v.handle = handle;
    v.spring = next;
    rewinds.recued(v);
  };

  function stop(id: number): void {
    const v = voices.get(id);
    if (!v) return;
    if (v.queued) v.queued = undefined;
    else v.handle.fade({ over: 0 });
    rewinds.remove(v);
    lanes.leave(v.slot);
    voices.delete(id);
  }

  return {
    frame(dtMs) {
      for (const v of queue) cueQueued(v, fault);
      queue.length = 0;
      time = Math.min(Number.MAX_VALUE, time + dtMs);
      lanes.frame(time);
      rewinds.frame();
    },
    tween(s) {
      const v = joinTween(lanes, s);
      voices.set(s.id, v);
      queue.push(v);
      return v.slot;
    },
    spring(s) {
      const v = joinSpring(lanes, s);
      voices.set(s.id, v);
      const reader = v.slot as Slot & SpringReader;
      if (s.on === undefined) reader.motion = () => springMotion(v);
      return reader;
    },
    path(s) {
      const v = joinPath(lanes, s, fault);
      voices.set(s.id, v);
      return v.slot;
    },
    retarget(id, to) {
      const v = get(id);
      if (v.kind !== 'spring') throw new Error(`codec: subject ${id} is a ${v.kind}; ${v.kind}s are not retargeted`);
      const sp = v.spring!;
      if ((to == null) === (sp.to == null)) {
        if (!to) return;
        sp.to = to.slice();
        v.handle.to(v.slot.key, sp.to);
        return;
      }
      // Held and free run different patches, so the voice is re-cued from where it is.
      const now = springMotion(v);
      respring(v, { ...sp, to: to && to.slice(), from: now.value, velocity: now.velocity });
    },
    recue(id, from, velocity, to) {
      const v = get(id);
      if (v.kind !== 'spring') throw new Error(`codec: subject ${id} is a ${v.kind}; only springs are re-cued`);
      respring(v, { ...v.spring!, from: from.slice(), velocity: velocity.slice(), to: to && to.slice() });
    },
    push(id, velocity) {
      const v = get(id);
      if (v.kind !== 'spring') return;
      if (!motionOf(v)) v.spring!.velocity = velocity.slice();
      v.handle.push(v.slot.key, velocity);
    },
    rate(id, rate) {
      const v = get(id);
      rewinds.rate(v, rate);
      if (v.queued) v.queuedRate = rate;
      else v.handle.rate = rate;
    },
    rewound: (id) => { const v = voices.get(id); return v !== undefined && rewinds.has(v); },
    stop,
    has: (id) => voices.has(id),
    own(id) {
      const v = voices.get(id);
      return v && ownOf(v, rewinds.has(v));
    },
    voiceCount: () => voices.size,
    columns: (group) => lanes.columns(group),
  };
}
