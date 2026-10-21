import {
  glide, patch as fnPatch, spring as springPatch, tween as tweenPatch,
  type Handle, type Motion, type Patch,
} from '@msb235/blits';
import { createLanes, type LaneColumns, type LanePlace, type Out, type Reader, type Slot } from './lanes';
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

/** What the codec calls on a motion patch: a tween has no `push`, a glide no `to`. */
interface Moves {
  to?(key: unknown, target: number[], at?: number): void;
  read(key: unknown, at?: number): Motion<number[]> | undefined;
  push?(key: unknown, velocity: number[], at?: number): void;
}

interface Voice {
  kind: 'tween' | 'spring' | 'path';
  slot: Slot;
  /** `handle` and `patch` are absent while a tween is `queued`, and a path has
   *  no `patch`. */
  handle: Handle<unknown>;
  patch: Moves;
  /** Where it started: what `own` answers until a frame has read it. */
  from: number[];
  /** The codec's own copy, kept at the voice's motion as of its last re-cue. */
  spring?: SpringStart;
  /** A tween's start, until the next `frame` cues its voice. */
  queued?: TweenStart;
  /** A rate asked for while queued. */
  queuedRate?: number;
  /** A path's axes as its patch last answered. */
  last?: number[];
}

// A voice cued now reads voice time 0 at codec time `time`. Each patch holds its subject at rest
// at `from`, and the codec releases it with a `to` or `push` timed at 0.
function springVoice(slot: Slot, sp: SpringStart): { handle: Handle<unknown>; patch: Moves } {
  // With no target the spring force is zero whatever the stiffness, leaving damping alone:
  // velocity falls as exp(-t * damping / mass), a glide whose time constant is mass / damping.
  const patch: Moves & Patch<unknown, Out, void> = sp.to == null
    ? glide<unknown, Out, number[]>('v', { from: sp.from, ms: (1000 * sp.mass) / sp.damping })
    : springPatch<unknown, Out, number[]>('v', {
      from: sp.from, to: sp.from, stiffness: sp.stiffness, damping: sp.damping, mass: sp.mass,
    });
  const handle = slot.lane.mix.cue({ patch, subjects: [slot.key] });
  if (sp.to) patch.to!(slot.key, sp.to, 0);
  patch.push!(slot.key, sp.velocity, 0);
  return { handle, patch };
}

const zeros = (n: number): number[] => new Array<number>(n).fill(0);

/** `placeOf` answers where a shared subject's voices run, for one kept in a lane of its own. */
export function createCodec(placeOf?: (on: object) => LanePlace | undefined): Codec {
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
  /** A spring voice's motion now: as its voice last read it, else where it was last placed. */
  const current = (v: Voice): Own =>
    v.patch.read(v.slot.key) ?? { value: v.spring!.from.slice(), velocity: v.spring!.velocity.slice() };

  const respring = (v: Voice, next: SpringStart): void => {
    const rate = v.handle.rate;
    v.handle.fade({ over: 0 });
    const { handle, patch } = springVoice(v.slot, next);
    handle.rate = rate;
    v.handle = handle;
    v.patch = patch;
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
      for (const v of queue) {
        const q = v.queued;
        if (!q) continue;
        v.queued = undefined;
        const key = v.slot.key;
        const patch = tweenPatch<unknown, Out, number[]>('v', { from: q.from.slice(), to: q.from.slice(), ms: q.ms, ease: q.ease });
        v.handle = v.slot.lane.mix.cue({ patch, subjects: [key], seek: q.atEnd ? q.ms : 0 });
        v.patch = patch;
        patch.to(key, q.to.slice(), 0);
        if (v.queuedRate !== undefined) v.handle.rate = v.queuedRate;
      }
      queue.length = 0;
      time += dtMs;
      lanes.frame(time);
      rewinds.frame();
    },
    tween(s) {
      if (s.to.length !== s.from.length) {
        throw new Error(`codec: tween ${s.id} goes from ${s.from.length} axes to ${s.to.length}`);
      }
      const shared = s.on !== undefined;
      const slot = lanes.join(s.from.length, shared ? s.on : s.id, shared ? zeros(s.from.length) : s.atEnd ? s.to : s.from);
      const v = { kind: 'tween', slot, from: s.from, queued: s } as Voice;
      voices.set(s.id, v);
      queue.push(v);
      return slot;
    },
    spring(s) {
      const sp = { ...s, from: s.from.slice(), to: s.to && s.to.slice(), velocity: s.velocity.slice() };
      const shared = s.on !== undefined;
      const slot = lanes.join(sp.axes, shared ? s.on : s.id, shared ? new Array<number>(sp.axes).fill(0) : sp.from);
      const { handle, patch } = springVoice(slot, sp);
      const v: Voice = { kind: 'spring', slot, handle, patch, from: sp.from, spring: sp };
      voices.set(s.id, v);
      const reader = slot as Slot & SpringReader;
      if (!shared) reader.motion = () => current(v);
      return reader;
    },
    path(s) {
      const shared = s.on !== undefined;
      const from = s.at(0);
      const last = s.atEnd ? s.at(1) : undefined;
      const slot = lanes.join(s.axes, shared ? s.on : s.id, shared ? zeros(s.axes) : last ?? from);
      const v = { kind: 'path', slot, from, last } as Voice;
      const patch = fnPatch<unknown, Out>(s.ms, (phase) => {
        v.last = s.at(phase);
        return { v: v.last };
      }, { writes: ['v'] });
      // Held at its end until the animator stops it, so a frame between the two reads the end.
      v.handle = slot.lane.mix.cue({ patch, subjects: [slot.key], loop: false, freeze: 'after', seek: s.atEnd ? s.ms : 0 });
      voices.set(s.id, v);
      return slot;
    },
    retarget(id, to) {
      const v = get(id);
      if (v.kind !== 'spring') throw new Error(`codec: subject ${id} is a ${v.kind}; ${v.kind}s are not retargeted`);
      const sp = v.spring!;
      if ((to == null) === (sp.to == null)) {
        if (!to) return;
        sp.to = to.slice();
        v.patch.to!(v.slot.key, sp.to);
        return;
      }
      // Held and free run different patches, so the voice is re-cued from where it is.
      const now = current(v);
      respring(v, { ...sp, to: to && to.slice(), from: now.value, velocity: now.velocity });
    },
    recue(id, from, velocity, to) {
      const v = get(id);
      if (v.kind !== 'spring') throw new Error(`codec: subject ${id} is a ${v.kind}; only springs are re-cued`);
      respring(v, { ...v.spring!, from: from.slice(), velocity: velocity.slice(), to: to && to.slice() });
    },
    push(id, velocity) {
      const v = get(id);
      if (v.spring && !v.patch.read(v.slot.key)) v.spring.velocity = velocity.slice();
      v.patch.push?.(v.slot.key, velocity);
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
      if (!v) return undefined;
      if (v.kind === 'spring') return current(v);
      if (v.kind === 'path') {
        return { value: v.last ?? v.from, velocity: new Array<number>(v.from.length).fill(0) };
      }
      return (!v.queued && v.patch.read(v.slot.key))
        || { value: v.queued?.atEnd ? v.queued.to : v.from, velocity: zeros(v.from.length) };
    },
    voiceCount: () => voices.size,
    columns: (group) => lanes.columns(group),
  };
}
