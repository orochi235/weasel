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
  ids: number[];
  /** Rebuilt when `ids` changes, so `pull` sees the same array frame to frame. */
  cols: { v: Float64Array };
  solo: boolean;
}

interface Subject {
  voice: Voice;
  kind: 'tween' | 'spring';
  /** Bank time it started at; a tween's elapsed time is the bank's time less this. */
  start: number;
  ease: (u: number) => number;
  spring?: SpringStart;
  slot: number;
}

export function createBank(): Bank {
  const voices = new Map<string, Voice>();
  const subjects = new Map<number, Subject>();
  let time = 0;
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

  const reslot = (v: Voice): void => {
    v.ids = v.ids.slice();
    v.cols = { v: new Float64Array(v.ids.length * v.axes) };
    v.ids.forEach((id, i) => { subjects.get(id)!.slot = i; });
  };
  const join = (v: Voice, id: number): void => {
    v.ids.push(id);
    reslot(v);
  };
  const leave = (v: Voice, id: number): void => {
    v.ids = v.ids.filter((x) => x !== id);
    reslot(v);
    if (v.solo && v.ids.length === 0) {
      v.handle.fade({ over: 0 });
      voices.delete(v.key);
    }
  };
  const cue = (key: string, axes: number, patch: Patch<number, Out, void>, moves: Moves, solo: boolean): Voice => {
    const m = mixOf(axes);
    const v: Voice = {
      key, axes, mix: m, cuedAt: time, handle: m.cue({ patch }), patch: moves,
      ids: [], cols: { v: new Float64Array(0) }, solo,
    };
    voices.set(key, v);
    return v;
  };

  const tweenVoice = (ease: (u: number) => number, axes: number, solo: string | null): Voice => {
    const key = solo ?? `tween:${easeKey(ease)}:${axes}`;
    const v = voices.get(key);
    if (v) return v;
    const patch = tweenPatch<number, Out, number[]>('v', {
      from: (id) => tweenFrom.get(id)!, to: (id) => tweenTo.get(id)!, ms: (id) => ms.get(id)!, ease,
    });
    return cue(key, axes, patch, patch, solo != null);
  };

  const springVoice = (s: SpringStart, solo: string | null): Voice => {
    const key = solo ?? `spring:${s.stiffness}:${s.damping}:${s.mass}:${s.to == null ? 'free' : 'held'}:${s.axes}`;
    const v = voices.get(key);
    if (v) return v;
    const from = (id: number) => springOf.get(id)!.from;
    const velocity = (id: number) => springOf.get(id)!.velocity;
    // With no target the spring force is zero whatever the stiffness, leaving damping alone:
    // velocity falls as exp(-t * damping / mass), a glide whose time constant is mass / damping.
    const patch = s.to == null
      ? glide<number, Out, number[]>('v', { from, velocity, ms: (1000 * s.mass) / s.damping })
      : springPatch<number, Out, number[]>('v', {
        from, to: (id) => springOf.get(id)!.to ?? springOf.get(id)!.from,
        velocity, stiffness: s.stiffness, damping: s.damping, mass: s.mass,
      });
    return cue(key, s.axes, patch, patch, solo != null);
  };

  const get = (id: number): Subject => {
    const s = subjects.get(id);
    if (!s) throw new Error(`bank: no subject ${id}`);
    return s;
  };
  const read = (s: Subject, id: number): Motion<number[]> => {
    const m = s.voice.patch.read(id);
    if (!m) throw new Error(`bank: subject ${id} not read yet; call frame() first`);
    return m;
  };

  return {
    frame(dtMs) {
      time += dtMs;
      for (const v of voices.values()) {
        v.mix.sync(time);
        if (v.ids.length) v.mix.pull(v.ids, v.cols);
      }
    },
    tween(s) {
      ms.set(s.id, s.ms);
      tweenFrom.set(s.id, s.from);
      tweenTo.set(s.id, s.to);
      const v = tweenVoice(s.ease, s.from.length, null);
      subjects.set(s.id, { voice: v, kind: 'tween', start: time, ease: s.ease, slot: 0 });
      join(v, s.id);
      v.patch.to!(s.id, s.to, local(v));
    },
    spring(s) {
      springOf.set(s.id, s);
      const v = springVoice(s, null);
      subjects.set(s.id, { voice: v, kind: 'spring', start: time, ease: (u) => u, spring: s, slot: 0 });
      join(v, s.id);
      if (s.to) v.patch.to!(s.id, s.to, local(v));
    },
    values(id) {
      const s = get(id);
      const n = s.voice.axes;
      return s.voice.cols.v.subarray(s.slot * n, s.slot * n + n);
    },
    motion(id) {
      const m = read(get(id), id);
      return { value: m.value.slice(), velocity: m.velocity.slice() };
    },
    retarget(id, to) {
      const s = get(id);
      s.spring!.to = to;
      if (!to) return;
      if (!s.voice.patch.to) throw new Error(`bank: subject ${id} glides and has no target to move`);
      s.voice.patch.to(id, to);
    },
    push(id, velocity) {
      get(id).voice.patch.push?.(id, velocity);
    },
    solo(id, rate) {
      const s = get(id);
      if (s.voice.solo) { s.voice.handle.rate = rate; return; }
      const from = s.voice;
      const key = `solo:${id}`;
      if (s.kind === 'tween') {
        const v = tweenVoice(s.ease, from.axes, key);
        from.handle.fade({ subject: id, over: 0 });
        leave(from, id);
        s.voice = v;
        join(v, id);
        v.patch.to!(id, tweenTo.get(id)!, 0);
        v.handle.seek(time - s.start);
        v.handle.rate = rate;
      } else {
        const now = read(s, id);
        const sp = { ...s.spring!, from: now.value.slice(), velocity: now.velocity.slice() };
        springOf.set(id, sp);
        s.spring = sp;
        const v = springVoice(sp, key);
        from.handle.fade({ subject: id, over: 0 });
        leave(from, id);
        s.voice = v;
        join(v, id);
        if (sp.to) v.patch.to!(id, sp.to, local(v));
        v.handle.rate = rate;
      }
    },
    stop(id) {
      const s = subjects.get(id);
      if (!s) return;
      s.voice.handle.fade({ subject: id, over: 0 });
      leave(s.voice, id);
      subjects.delete(id);
      ms.delete(id);
      tweenFrom.delete(id);
      tweenTo.delete(id);
      springOf.delete(id);
    },
  };
}
