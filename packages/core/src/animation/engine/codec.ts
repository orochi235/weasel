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
/** One subject's value, read without looking the subject up. Valid until the subject stops. */
export interface Reader {
  /** The array holding the subject's axes as the last `frame` read them, from `offset()` on.
   *  It is the codec's own, shared with other subjects and valid until the next `frame`. */
  column(): Float64Array;
  /** Where the subject's axes start in `column()`. */
  offset(): number;
}
export interface SpringReader extends Reader {
  /** Position and velocity at the last `frame`. */
  motion(): { value: number[]; velocity: number[] };
}
export interface Codec {
  /** Advances the codec's clock by `dtMs` of animator time, then reads every subject. */
  frame(dtMs: number): void;
  tween(s: TweenStart): Reader;
  spring(s: SpringStart): SpringReader;
  retarget(id: number, to: number[] | null): void;
  push(id: number, velocity: number[]): void;
  /** Plays `id` at rate `rate` from where it is, without a jump. */
  rate(id: number, rate: number): void;
  stop(id: number): void;
  /** Whether `id` is one of the codec's subjects. */
  has(id: number): boolean;
  /** How many voices the codec is running, one per subject; for tests and diagnostics. */
  voiceCount(): number;
}

type Out = { v: number[] };

/** What the codec calls on a motion patch: a tween has no `push`, a glide no `to`. */
interface Moves {
  to?(id: number, target: number[], at?: number): void;
  read(id: number, at?: number): Motion<number[]> | undefined;
  push?(id: number, velocity: number[], at?: number): void;
}

/** One mix per axis count, since a kit's channel width is fixed. */
interface Lane {
  axes: number;
  mix: Mix<number, Out>;
  /** The subjects `pull` reads, by slot. Joins wait in `pending` until the next `frame`. */
  ids: number[];
  pending: Set<number>;
  dirty: boolean;
  /** Frames in a row it has had no subjects at; it retires at the second. */
  idle: number;
  cols: { v: Float64Array };
}

interface Subject {
  kind: 'tween' | 'spring';
  lane: Lane;
  handle: Handle<number>;
  patch: Moves;
  /** The codec's own copy, kept at the subject's motion as of its last re-cue. */
  spring?: SpringStart;
  /** Index into the lane's `ids`; -1 while no frame has read it. */
  slot: number;
  /** What `column` answers while `slot` is -1. */
  held: Float64Array;
}

export function createCodec(): Codec {
  const lanes = new Map<number, Lane>();
  const subjects = new Map<number, Subject>();
  let time = 0;

  const laneOf = (axes: number): Lane => {
    let l = lanes.get(axes);
    if (!l) {
      const m = mix<number, Out>(kit<Out>({ v: vec(axes, sum()) }));
      m.sync(time);
      l = { axes, mix: m, ids: [], pending: new Set(), dirty: false, idle: 0, cols: { v: new Float64Array(0) } };
      lanes.set(axes, l);
    }
    return l;
  };
  const join = (s: Subject, id: number): void => {
    s.slot = -1;
    s.lane.pending.add(id);
    s.lane.dirty = true;
  };
  const depart = (s: Subject, id: number): void => {
    const l = s.lane;
    l.dirty = true;
    if (s.slot < 0) { l.pending.delete(id); return; }
    const last = l.ids.pop()!;
    if (last === id) return;
    const n = l.axes;
    const from = l.ids.length * n;
    l.cols.v.copyWithin(s.slot * n, from, from + n);
    l.ids[s.slot] = last;
    subjects.get(last)!.slot = s.slot;
  };
  const rebuild = (l: Lane): void => {
    const ids = l.ids.slice();
    for (const id of l.pending) {
      subjects.get(id)!.slot = ids.length;
      ids.push(id);
    }
    l.pending.clear();
    l.ids = ids;
    if (l.cols.v.length !== ids.length * l.axes) l.cols = { v: new Float64Array(ids.length * l.axes) };
    l.dirty = false;
  };

  // A voice cued now reads voice time 0 at codec time `time`. Each patch holds its subject at rest
  // at `from`, and the codec releases it with a `to` or `push` timed at 0.
  const springVoice = (l: Lane, id: number, sp: SpringStart): { handle: Handle<number>; patch: Moves } => {
    // With no target the spring force is zero whatever the stiffness, leaving damping alone:
    // velocity falls as exp(-t * damping / mass), a glide whose time constant is mass / damping.
    const patch: Moves & Patch<number, Out, void> = sp.to == null
      ? glide<number, Out, number[]>('v', { from: sp.from, ms: (1000 * sp.mass) / sp.damping })
      : springPatch<number, Out, number[]>('v', {
        from: sp.from, to: sp.from, stiffness: sp.stiffness, damping: sp.damping, mass: sp.mass,
      });
    const handle = l.mix.cue({ patch, subjects: [id] });
    if (sp.to) patch.to!(id, sp.to, 0);
    patch.push!(id, sp.velocity, 0);
    return { handle, patch };
  };

  const get = (id: number): Subject => {
    const s = subjects.get(id);
    if (!s) throw new Error(`codec: no subject ${id}`);
    return s;
  };
  /** A spring subject's motion now: as its voice last read it, else where it was last placed. */
  const current = (s: Subject, id: number): { value: number[]; velocity: number[] } =>
    s.patch.read(id) ?? { value: s.spring!.from.slice(), velocity: s.spring!.velocity.slice() };

  function stop(id: number): void {
    const s = subjects.get(id);
    if (!s) return;
    s.handle.fade({ over: 0 });
    s.lane.mix.drop(id);
    depart(s, id);
    subjects.delete(id);
  }
  const readerOf = (s: Subject): Reader => ({
    column: () => (s.slot < 0 ? s.held : s.lane.cols.v),
    offset: () => (s.slot < 0 ? 0 : s.slot * s.lane.axes),
  });

  return {
    frame(dtMs) {
      time += dtMs;
      for (const l of lanes.values()) {
        if (l.dirty) rebuild(l);
        if (l.ids.length === 0 && ++l.idle >= 2) {
          lanes.delete(l.axes);
          continue;
        }
        l.mix.sync(time);
        if (l.ids.length === 0) continue;
        l.idle = 0;
        l.mix.pull(l.ids, l.cols);
      }
    },
    tween(s) {
      const l = laneOf(s.from.length);
      const patch = tweenPatch<number, Out, number[]>('v', { from: s.from.slice(), to: s.from.slice(), ms: s.ms, ease: s.ease });
      const handle = l.mix.cue({ patch, subjects: [s.id] });
      const sub: Subject = { kind: 'tween', lane: l, handle, patch, slot: -1, held: Float64Array.from(s.from) };
      subjects.set(s.id, sub);
      join(sub, s.id);
      try {
        patch.to(s.id, s.to.slice(), 0);
      } catch (err) {
        stop(s.id);
        throw err;
      }
      return readerOf(sub);
    },
    spring(s) {
      const sp = { ...s, from: s.from.slice(), to: s.to && s.to.slice(), velocity: s.velocity.slice() };
      const l = laneOf(sp.axes);
      const { handle, patch } = springVoice(l, s.id, sp);
      const sub: Subject = { kind: 'spring', lane: l, handle, patch, spring: sp, slot: -1, held: Float64Array.from(sp.from) };
      subjects.set(s.id, sub);
      join(sub, s.id);
      const id = s.id;
      return { ...readerOf(sub), motion: () => current(sub, id) };
    },
    retarget(id, to) {
      const s = get(id);
      if (s.kind === 'tween') throw new Error(`codec: subject ${id} is a tween; tweens are not retargeted`);
      const sp = s.spring!;
      if ((to == null) === (sp.to == null)) {
        if (!to) return;
        sp.to = to.slice();
        s.patch.to!(id, sp.to);
        return;
      }
      // Held and free run different patches, so the subject is re-cued from where it is.
      const now = current(s, id);
      const rate = s.handle.rate;
      const next = { ...sp, to: to && to.slice(), from: now.value, velocity: now.velocity };
      s.handle.fade({ over: 0 });
      const { handle, patch } = springVoice(s.lane, id, next);
      handle.rate = rate;
      s.handle = handle;
      s.patch = patch;
      s.spring = next;
    },
    push(id, velocity) {
      const s = get(id);
      if (s.spring && !s.patch.read(id)) s.spring.velocity = velocity.slice();
      s.patch.push?.(id, velocity);
    },
    rate(id, rate) {
      get(id).handle.rate = rate;
    },
    stop,
    has: (id) => subjects.has(id),
    voiceCount() {
      return subjects.size;
    },
  };
}
