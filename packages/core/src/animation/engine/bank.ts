import {
  glide, kit, mix, spring as springPatch, sum, tween as tweenPatch, vec,
  type Handle, type Mix, type Motion, type Patch,
} from '@msb235/blits';

export interface TweenStart {
  id: number; ms: number; ease: (u: number) => number;
  /** Endpoints as axes. A tween whose caller blends its own values passes [0] and [1]. */
  from: number[]; to: number[];
}
export interface SpringStart {
  id: number; axes: number;
  from: number[]; to: number[] | null; velocity: number[];
  stiffness: number; damping: number; mass: number;
}
export interface Bank {
  /** Advances the bank's clock by `dtMs` of animator time, then reads every subject. */
  frame(dtMs: number): void;
  tween(s: TweenStart): void;
  spring(s: SpringStart): void;
  /** A tween subject's axes as the last `frame` read them: a view into the bank's arrays, valid
   *  until the next `frame`. */
  values(id: number): Float64Array;
  /** Position and velocity of a spring subject at the last `frame`. */
  motion(id: number): { value: number[]; velocity: number[] };
  retarget(id: number, to: number[] | null): void;
  push(id: number, velocity: number[]): void;
  /** Moves `id` onto a voice of its own, at rate `rate`, without a jump. */
  solo(id: number, rate: number): void;
  stop(id: number): void;
  /** How many voices the bank is running; for tests and diagnostics. */
  voiceCount(): number;
}

type Out = { v: number[] };

/** What the bank calls on a motion patch: a tween has no `push`, a glide no `to`. */
interface Moves {
  to?(id: number, target: number[], at?: number): void;
  read(id: number, at?: number): Motion<number[]> | undefined;
  push?(id: number, velocity: number[], at?: number): void;
}

interface Voice {
  key: string;
  axes: number;
  mix: Mix<number, Out>;
  /** Bank time the voice was cued at. Its own clock reads bank time less this, while at rate 1. */
  cuedAt: number;
  handle: Handle<number>;
  patch: Moves;
  /** The subjects `pull` reads, by slot. Joins wait in `pending` until the next `frame`. */
  ids: number[];
  pending: Set<number>;
  dirty: boolean;
  /** Frames in a row it has had no subjects at; it retires at the second. */
  idle: number;
  cols: { v: Float64Array };
  solo: boolean;
}

interface Subject {
  voice: Voice;
  kind: 'tween' | 'spring';
  /** Bank time it started at; a tween's elapsed time is the bank's time less this. */
  start: number;
  ease?: (u: number) => number;
  /** The bank's own copy, kept at the subject's motion as of its last move between voices. */
  spring?: SpringStart;
  /** Index into the voice's `ids`; -1 while no frame has read it on this voice. */
  slot: number;
  /** What `values` answers while `slot` is -1. */
  held: Float64Array;
}

export function createBank(): Bank {
  const voices = new Map<string, Voice>();
  const subjects = new Map<number, Subject>();
  let time = 0;
  let soloSerial = 0;
  const mixOf = (axes: number): Mix<number, Out> => {
    const m = mix<number, Out>(kit<Out>({ v: vec(axes, sum()) }));
    m.sync(time);
    return m;
  };
  /** Bank time as voice `v`'s clock reads it. Shared voices stay at rate 1; a solo voice is
   *  re-rated only after its one subject is placed. */
  const local = (v: Voice): number => time - v.cuedAt;
  const easeIds = new WeakMap<(u: number) => number, number>();
  let nextEase = 1;
  const easeKey = (f: (u: number) => number): number => {
    let k = easeIds.get(f);
    if (k == null) { k = nextEase++; easeIds.set(f, k); }
    return k;
  };
  const ms = new Map<number, number>();
  const tweenFrom = new Map<number, number[]>();
  const tweenTo = new Map<number, number[]>();
  const springOf = new Map<number, SpringStart>();

  const join = (v: Voice, id: number): void => {
    subjects.get(id)!.slot = -1;
    v.pending.add(id);
    v.dirty = true;
  };
  const depart = (s: Subject, id: number): void => {
    const v = s.voice;
    v.mix.drop(id);
    v.dirty = true;
    if (s.slot < 0) { v.pending.delete(id); return; }
    const last = v.ids.pop()!;
    if (last === id) return;
    const n = v.axes;
    const from = v.ids.length * n;
    v.cols.v.copyWithin(s.slot * n, from, from + n);
    v.ids[s.slot] = last;
    subjects.get(last)!.slot = s.slot;
  };
  const rebuild = (v: Voice): void => {
    const ids = v.ids.slice();
    for (const id of v.pending) {
      subjects.get(id)!.slot = ids.length;
      ids.push(id);
    }
    v.pending.clear();
    v.ids = ids;
    if (v.cols.v.length !== ids.length * v.axes) v.cols = { v: new Float64Array(ids.length * v.axes) };
    v.dirty = false;
  };
  const cue = (key: string, axes: number, patch: Patch<number, Out, void>, moves: Moves, solo: boolean): Voice => {
    const m = mixOf(axes);
    const v: Voice = {
      key, axes, mix: m, cuedAt: time, handle: m.cue({ patch }), patch: moves,
      ids: [], pending: new Set(), dirty: false, idle: 0, cols: { v: new Float64Array(0) }, solo,
    };
    voices.set(key, v);
    return v;
  };

  // blits writes a subject's first stretch at voice time 0, so every patch starts a subject at
  // rest at `from`, and the bank releases it with a timed `to` or `push` at the time it joins.
  const tweenVoice = (ease: (u: number) => number, axes: number, solo: string | null): Voice => {
    const key = solo ?? `tween:${easeKey(ease)}:${axes}`;
    const v = voices.get(key);
    if (v) return v;
    const from = (id: number) => tweenFrom.get(id)!;
    const patch = tweenPatch<number, Out, number[]>('v', { from, to: from, ms: (id) => ms.get(id)!, ease });
    return cue(key, axes, patch, patch, solo != null);
  };

  const springVoice = (s: SpringStart, solo: string | null): Voice => {
    const key = solo ?? `spring:${s.stiffness}:${s.damping}:${s.mass}:${s.to == null ? 'free' : 'held'}:${s.axes}`;
    const v = voices.get(key);
    if (v) return v;
    const from = (id: number) => springOf.get(id)!.from;
    // With no target the spring force is zero whatever the stiffness, leaving damping alone:
    // velocity falls as exp(-t * damping / mass), a glide whose time constant is mass / damping.
    const patch = s.to == null
      ? glide<number, Out, number[]>('v', { from, ms: (1000 * s.mass) / s.damping })
      : springPatch<number, Out, number[]>('v', {
        from, to: from, stiffness: s.stiffness, damping: s.damping, mass: s.mass,
      });
    return cue(key, s.axes, patch, patch, solo != null);
  };

  /** Puts spring subject `id`, whose `springOf` entry is already set, onto `v` from its start. */
  const enterSpring = (v: Voice, id: number, sp: SpringStart): void => {
    join(v, id);
    const at = local(v);
    if (sp.to) v.patch.to!(id, sp.to, at);
    v.patch.push!(id, sp.velocity, at);
  };

  const get = (id: number): Subject => {
    const s = subjects.get(id);
    if (!s) throw new Error(`bank: no subject ${id}`);
    return s;
  };
  /** A spring subject's motion now: as its voice last read it, else where it was last placed. */
  const current = (s: Subject, id: number): { value: number[]; velocity: number[] } => {
    const m = s.slot < 0 ? undefined : s.voice.patch.read(id);
    if (m) return m;
    return { value: s.spring!.from.slice(), velocity: s.spring!.velocity.slice() };
  };
  /** Moves spring subject `id` to a fresh start `sp` from where it is, onto a solo voice at `rate`
   *  or, with `rate` null, onto the shared voice for `sp`. */
  const moveSpring = (s: Subject, id: number, sp: SpringStart, rate: number | null): void => {
    const now = current(s, id);
    const next = { ...sp, from: now.value, velocity: now.velocity };
    const v = springVoice(next, rate == null ? null : `solo:${id}:${soloSerial++}`);
    depart(s, id);
    springOf.set(id, next);
    s.spring = next;
    s.held = Float64Array.from(now.value);
    s.voice = v;
    enterSpring(v, id, next);
    if (rate != null) v.handle.rate = rate;
  };

  function values(id: number): Float64Array {
    const s = get(id);
    if (s.slot < 0) return s.held;
    const n = s.voice.axes;
    return s.voice.cols.v.subarray(s.slot * n, s.slot * n + n);
  }

  return {
    frame(dtMs) {
      time += dtMs;
      for (const v of voices.values()) {
        if (v.dirty) rebuild(v);
        if (v.ids.length === 0) {
          if (++v.idle >= 2) {
            v.handle.fade({ over: 0 });
            voices.delete(v.key);
          }
          continue;
        }
        v.idle = 0;
        v.mix.sync(time);
        v.mix.pull(v.ids, v.cols);
      }
    },
    tween(s) {
      ms.set(s.id, s.ms);
      tweenFrom.set(s.id, s.from.slice());
      tweenTo.set(s.id, s.to.slice());
      const v = tweenVoice(s.ease, s.from.length, null);
      subjects.set(s.id, { voice: v, kind: 'tween', start: time, ease: s.ease, slot: -1, held: Float64Array.from(s.from) });
      join(v, s.id);
      v.patch.to!(s.id, s.to, local(v));
    },
    spring(s) {
      const sp = { ...s, from: s.from.slice(), to: s.to && s.to.slice(), velocity: s.velocity.slice() };
      springOf.set(s.id, sp);
      const v = springVoice(sp, null);
      subjects.set(s.id, { voice: v, kind: 'spring', start: time, spring: sp, slot: -1, held: Float64Array.from(sp.from) });
      enterSpring(v, s.id, sp);
    },
    values,
    motion(id) {
      const s = get(id);
      if (s.kind !== 'spring') throw new Error(`bank: subject ${id} is a tween and has no motion`);
      return current(s, id);
    },
    retarget(id, to) {
      const s = get(id);
      if (s.kind === 'tween') throw new Error(`bank: subject ${id} is a tween; tweens are not retargeted`);
      const sp = s.spring!;
      if ((to == null) === (sp.to == null)) {
        if (!to) return;
        sp.to = to.slice();
        s.voice.patch.to!(id, sp.to);
        return;
      }
      moveSpring(s, id, { ...sp, to: to && to.slice() }, s.voice.solo ? s.voice.handle.rate : null);
    },
    push(id, velocity) {
      const s = get(id);
      if (s.slot < 0 && s.spring) s.spring.velocity = velocity.slice();
      s.voice.patch.push?.(id, velocity);
    },
    solo(id, rate) {
      const s = get(id);
      if (s.voice.solo) { s.voice.handle.rate = rate; return; }
      if (s.kind === 'spring') { moveSpring(s, id, s.spring!, rate); return; }
      const v = tweenVoice(s.ease!, s.voice.axes, `solo:${id}:${soloSerial++}`);
      s.held = values(id).slice();
      depart(s, id);
      s.voice = v;
      join(v, id);
      v.patch.to!(id, tweenTo.get(id)!, 0);
      v.handle.seek(time - s.start);
      v.handle.rate = rate;
    },
    stop(id) {
      const s = subjects.get(id);
      if (!s) return;
      depart(s, id);
      subjects.delete(id);
      ms.delete(id);
      tweenFrom.delete(id);
      tweenTo.delete(id);
      springOf.delete(id);
    },
    voiceCount() {
      return voices.size;
    },
  };
}
