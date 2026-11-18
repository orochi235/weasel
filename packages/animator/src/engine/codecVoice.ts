import {
  glide, patch as fnPatch, spring as springPatch, tween as tweenPatch,
  type Handle, type Motion, type Patch,
} from '@msb235/blits';
import type { Lanes, Out, Slot } from './lanes';
import type { Own, PathStart, SpringStart, TweenStart } from './codec';

/** One of the codec's voices: a patch cued on its subject's slot. */
export interface Voice {
  kind: 'tween' | 'spring' | 'path';
  slot: Slot;
  /** Absent while a tween is `queued`. */
  handle: Handle<unknown>;
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
  /** A path's own start, and the linear progress its patch last read it at: none until a
   *  frame has, when it stands at rest as a queued tween does. */
  path?: PathStart;
  phase?: number;
}

export const zeros = (n: number): number[] => new Array<number>(n).fill(0);

/** A voice's motion as its patch last read it. Every codec voice moves `number[]` axes. */
export const motionOf = (v: Voice): Motion<number[]> | undefined =>
  v.handle.read(v.slot.key) as Motion<number[]> | undefined;

/** A spring voice's motion now: as its voice last read it, else where it was last placed. */
export const springMotion = (v: Voice): Own =>
  motionOf(v) ?? { value: v.spring!.from.slice(), velocity: v.spring!.velocity.slice() };

/** A path voice's velocity at its last reading, in axis units per second as a tween voice's: the
 *  path is any function, so its slope is read off it. Zero before a frame reads it and once it
 *  has ended. */
function pathVelocity(v: Voice): number[] {
  const { ms, at } = v.path!;
  const u = v.phase;
  if (u === undefined) return zeros(v.from.length);
  const du = Math.min(1, ms / 2) / ms;
  const a = Math.max(0, u - du);
  const b = Math.min(1, u + du);
  if (!(u < 1 && b > a)) return zeros(v.from.length);
  try {
    const pa = at(a);
    const pb = at(b);
    return pa.map((x, i) => ((pb[i]! - x) * 1000) / ((b - a) * ms));
  } catch {
    return zeros(v.from.length);
  }
}

/** Voice `v`'s own value and velocity as of the last frame; `rewound` says it has run back to its start. */
export function ownOf(v: Voice, rewound: boolean): Own {
  if (v.kind === 'spring') return springMotion(v);
  if (v.kind === 'path') {
    if (rewound) return { value: v.from, velocity: zeros(v.from.length) };
    return { value: v.last ?? v.from, velocity: pathVelocity(v) };
  }
  return (!v.queued && motionOf(v))
    || { value: v.queued?.atEnd ? v.queued.to : v.from, velocity: zeros(v.from.length) };
}

/** Cues the tween `v` waits to start, its `ease` throwing to `fault` rather than out of the frame. */
export function cueQueued(v: Voice, fault: (id: number, error: unknown) => void): void {
  const q = v.queued;
  if (!q) return;
  v.queued = undefined;
  const key = v.slot.key;
  const { id, ease } = q;
  const guarded = (u: number): number => {
    try { return ease(u); } catch (error) { fault(id, error); return u; }
  };
  const patch = tweenPatch<unknown, Out, number[]>('v', { from: q.from.slice(), to: q.from.slice(), ms: q.ms, ease: guarded });
  v.handle = v.slot.lane.mix.cue({ patch, subjects: [key], seek: q.atEnd ? q.ms : 0 });
  v.handle.to(key, q.to.slice(), 0);
  if (v.queuedRate !== undefined) v.handle.rate = v.queuedRate;
}

// A voice cued now reads voice time 0 at codec time `time`. Each patch holds its subject at rest
// at `from`, and the codec releases it with a `to` or `push` timed at 0.
export function cueSpring(slot: Slot, sp: SpringStart): Handle<unknown> {
  // With no target the spring force is zero whatever the stiffness, leaving damping alone:
  // velocity falls as exp(-t * damping / mass), a glide whose time constant is mass / damping.
  const patch: Patch<unknown, Out, void> = sp.to == null
    ? glide<unknown, Out, number[]>('v', { from: sp.from, ms: (1000 * sp.mass) / sp.damping })
    : springPatch<unknown, Out, number[]>('v', {
      from: sp.from, to: sp.from, stiffness: sp.stiffness, damping: sp.damping, mass: sp.mass,
    });
  const handle = slot.lane.mix.cue({ patch, subjects: [slot.key] });
  if (sp.to) handle.to(slot.key, sp.to, 0);
  handle.push(slot.key, sp.velocity, 0);
  return handle;
}

/** A tween's voice, waiting for the next frame to cue it. */
export function joinTween(lanes: Lanes, s: TweenStart): Voice {
  if (s.to.length !== s.from.length) {
    throw new Error(`codec: tween ${s.id} goes from ${s.from.length} axes to ${s.to.length}`);
  }
  const shared = s.on !== undefined;
  const slot = lanes.join(s.from.length, shared ? s.on : s.id, shared ? zeros(s.from.length) : s.atEnd ? s.to : s.from);
  return { kind: 'tween', slot, from: s.from, queued: s } as Voice;
}

/** A spring's voice, cued on a copy of `s` the codec keeps. */
export function joinSpring(lanes: Lanes, s: SpringStart): Voice {
  const sp = { ...s, from: s.from.slice(), to: s.to && s.to.slice(), velocity: s.velocity.slice() };
  const shared = s.on !== undefined;
  const slot = lanes.join(sp.axes, shared ? s.on : s.id, shared ? new Array<number>(sp.axes).fill(0) : sp.from);
  return { kind: 'spring', slot, handle: cueSpring(slot, sp), from: sp.from, spring: sp };
}

/** A path's voice, its `at` throwing to `fault` as {@link cueQueued}'s `ease` does. */
export function joinPath(lanes: Lanes, s: PathStart, fault: (id: number, error: unknown) => void): Voice {
  const shared = s.on !== undefined;
  const from = s.at(0);
  const last = s.atEnd ? s.at(1) : undefined;
  const slot = lanes.join(s.axes, shared ? s.on : s.id, shared ? zeros(s.axes) : last ?? from);
  const v = { kind: 'path', slot, from, last, path: s } as Voice;
  const patch = fnPatch<unknown, Out>(s.ms, (phase) => {
    v.phase = phase;
    try { v.last = s.at(phase); } catch (error) { fault(s.id, error); }
    return { v: v.last ?? from };
  }, { writes: ['v'] });
  // Held at its end until the animator stops it, so a frame between the two reads the end.
  v.handle = slot.lane.mix.cue({ patch, subjects: [slot.key], loop: false, freeze: 'after', seek: s.atEnd ? s.ms : 0 });
  return v;
}
