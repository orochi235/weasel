/**
 * The animator's frame against blits', for step 3 of
 * `docs/proposals/2026-09-30-animator-on-blits.md`.
 *
 * Every row animates N nodes' `{ x, y }` and one iteration is one 16 ms frame:
 * advance the clock, compute every node's value, store it where a painter
 * would read it. Three shapes:
 *
 * - **today** — one `animator.tween` / `animator.spring` per node, written
 *   the way `tweenPose` / `springPose` write: a fresh pose object per frame.
 * - **blits, voice per animation** — the literal port: each call cues its own
 *   voice, reaching its one node either by a `target` predicate or by naming
 *   it in `subjects`.
 * - **blits, one voice** — every node on one voice reading its own endpoints,
 *   the way step 2's override table is one voice. For tweens that is an `fn`
 *   patch, and, where blits has its `tween` motion form, also **one tween
 *   voice** carrying each node's endpoints as data.
 *
 * Nothing finishes inside a run: tweens last far longer than any run, and
 * springs are undamped, so they oscillate for good.
 *
 * The start groups time setup alone: N animations started and their first
 * frame computed, which is when blits first asks each voice which nodes it
 * reaches.
 *
 * The `target` rows hold ~800 MB per mix at 1k nodes and outgrow node's 4 GB
 * default heap: run with `NODE_OPTIONS=--max-old-space-size=12288`.
 */
import { renderHook } from '@testing-library/react';
import { easeOut } from '@weasel-js/geom';
import * as blits from '@msb235/blits';
import { keys, kit, mix, patch, spring, sum, vec, type Mix } from '@msb235/blits';
import { useAnimator, type Animator } from '@weasel-js/core';
import { group } from './group';

type Pt = { x: number; y: number };
type Delta = { pos: number[] };

const FRAME = 16;
const LONG = 1e9;
const KIT = kit<Delta>({ pos: vec(2, sum()) });
/** Undamped, so nothing comes to rest during a run. */
const SPRING = { stiffness: 1, damping: 0, mass: 1 };
/** Read once: a module export read per call adds vitest getter overhead. */
const EASE = easeOut;

interface Case {
  ids: string[];
  from: Pt[];
  to: Pt[];
  /** Where a painter would read node i's value from. */
  sink: Pt[];
}

function nodes(n: number): Case {
  const ids: string[] = [];
  const from: Pt[] = [];
  const to: Pt[] = [];
  const sink: Pt[] = [];
  for (let i = 0; i < n; i++) {
    ids.push(`n${i}`);
    from.push({ x: i, y: -i });
    to.push({ x: i + 500, y: 300 - i });
    sink.push({ x: 0, y: 0 });
  }
  return { ids, from, to, sink };
}

const lerpPt = (a: Pt, b: Pt, u: number): Pt => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });

// --- today ---------------------------------------------------------------

function mountAnimator(): { animator: Animator; frame: () => void; unmount: () => void } {
  let now = 0;
  const due: ((t: number) => void)[] = [];
  const { result, unmount } = renderHook(() =>
    useAnimator({
      now: () => now,
      requestFrame: (cb) => { due.push(cb); return due.length; },
      cancelFrame: () => {},
    }),
  );
  return {
    animator: result.current,
    frame: () => {
      now += FRAME;
      for (const cb of due.splice(0)) cb(now);
    },
    unmount,
  };
}

function startTodayTweens(animator: Animator, c: Case): void {
  c.ids.forEach((_, i) => {
    animator.tween<Pt>({
      from: c.from[i], to: c.to[i], ms: LONG, easing: EASE,
      interpolate: lerpPt,
      onTick: (v) => { c.sink[i] = v; },
    });
  });
}

function startTodaySprings(animator: Animator, c: Case): void {
  c.ids.forEach((_, i) => {
    const from = c.from[i];
    const to = c.to[i];
    animator.spring<number>({
      from: 0, to: 1, ...SPRING,
      onTick: (u) => { c.sink[i] = lerpPt(from, to, u); },
    });
  });
}

// --- blits ---------------------------------------------------------------

interface Driven {
  m: Mix<string, Delta>;
  t: number;
}

function blitsFrame(d: Driven, c: Case, out: Delta): void {
  d.t += FRAME;
  d.m.sync(d.t);
  const { ids, sink } = c;
  for (let i = 0; i < ids.length; i++) {
    const pos = d.m.probe(ids[i]!, out).pos;
    sink[i] = { x: pos[0]!, y: pos[1]! };
  }
}

/** How a voice-per-animation cue says which node it reaches: a predicate
 *  blits asks of every subject, or the subject named outright. */
type Reach = 'target' | 'subjects';
const reach = (how: Reach, id: string) =>
  how === 'target' ? { target: (s: string) => s === id } : { subjects: [id] };

const cueTweenPerVoice = (how: Reach) => (m: Mix<string, Delta>, c: Case): void => {
  c.ids.forEach((id, i) => {
    const a = c.from[i]!;
    const b = c.to[i]!;
    m.cue({
      patch: keys<string, Delta>(LONG, [
        { at: 0, delta: { pos: [a.x, a.y] } },
        { at: 1, delta: { pos: [b.x, b.y] } },
      ], { ease: EASE }),
      ...reach(how, id),
      loop: false,
    });
  });
};

function cueTweenOneVoice(m: Mix<string, Delta>, c: Case): void {
  const index = new Map(c.ids.map((id, i) => [id, i]));
  m.cue({
    patch: patch<string, Delta>(LONG, (phase, id) => {
      const i = index.get(id)!;
      const a = c.from[i]!;
      const b = c.to[i]!;
      const u = EASE(phase);
      return { pos: [a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u] };
    }, { writes: ['pos'] }),
    loop: false,
  });
}

/** blits' `tween` motion form, absent before 0.3.0. Typed here because 0.2.1's
 *  declarations have no `tween`. */
type TweenMotion = (writes: 'pos', opts: {
  from: (id: string) => number[];
  to: (id: string) => number[];
  ms: number;
  ease: (u: number) => number;
}) => ReturnType<typeof patch<string, Delta>>;
const tweenMotion = (blits as Record<string, unknown>).tween as TweenMotion | undefined;

function cueTweenMotion(m: Mix<string, Delta>, c: Case): void {
  const index = new Map(c.ids.map((id, i) => [id, i]));
  const at = (pts: Pt[]) => (id: string) => {
    const p = pts[index.get(id)!]!;
    return [p.x, p.y];
  };
  m.cue({ patch: tweenMotion!('pos', { from: at(c.from), to: at(c.to), ms: LONG, ease: EASE }), loop: false });
}

const cueSpringPerVoice = (how: Reach) => (m: Mix<string, Delta>, c: Case): void => {
  c.ids.forEach((id, i) => {
    const a = c.from[i]!;
    const b = c.to[i]!;
    m.cue({
      patch: spring<string, Delta, number[]>('pos', { from: [a.x, a.y], to: [b.x, b.y], ...SPRING, settle: 0 }),
      ...reach(how, id),
    });
  });
};

function cueSpringOneVoice(m: Mix<string, Delta>, c: Case): void {
  const index = new Map(c.ids.map((id, i) => [id, i]));
  const at = (pts: Pt[]) => (id: string) => {
    const p = pts[index.get(id)!]!;
    return [p.x, p.y];
  };
  m.cue({
    patch: spring<string, Delta, number[]>('pos', { from: at(c.from), to: at(c.to), ...SPRING, settle: 0 }),
  });
}

/** Lanes off, for comparison; blits before lanes ignores it. Cast because
 *  0.2.1's `MixOptions` has no `lanes`. */
const NO_LANES = { lanes: false } as never;

function driven(
  n: number,
  cue: (m: Mix<string, Delta>, c: Case) => void,
  opts?: never,
): { d: Driven; c: Case } {
  const c = nodes(n);
  const m = mix<string, Delta>(KIT, opts);
  const d = { m, t: 0 };
  m.sync(0);
  cue(m, c);
  return { d, c };
}

/** Throws unless two runs put every node within `tol` of each other, so a row
 *  that computes the wrong thing cannot time as fast. */
function agree(label: string, a: Pt[], b: Pt[], tol: number): void {
  for (let i = 0; i < a.length; i++) {
    const dx = Math.abs(a[i]!.x - b[i]!.x);
    const dy = Math.abs(a[i]!.y - b[i]!.y);
    if (dx > tol || dy > tol) {
      throw new Error(`${label}: node ${i} at ${JSON.stringify(b[i])}, expected ${JSON.stringify(a[i])}`);
    }
  }
}

// --- groups --------------------------------------------------------------

type Cue = (m: Mix<string, Delta>, c: Case) => void;

const KINDS = [
  {
    kind: 'tween', today: startTodayTweens, perVoice: cueTweenPerVoice,
    oneVoice: [
      ['one voice', cueTweenOneVoice],
      ...(tweenMotion ? [['one tween voice', cueTweenMotion] as const] : []),
    ] as [string, Cue][],
  },
  {
    kind: 'spring', today: startTodaySprings, perVoice: cueSpringPerVoice,
    oneVoice: [['one voice', cueSpringOneVoice]] as [string, Cue][],
  },
] as const;

/** The `target` form only where its setup, which grows with N², finishes in a run. */
const TARGET_MAX = 1000;
/** blits before `subjects` (0.2.1) ignores it and reaches every node; skip
 *  the rows there. */
const HAS_SUBJECTS = (() => {
  const m = mix<string, Delta>(KIT);
  m.sync(0);
  m.cue({ patch: patch(LONG, () => ({ pos: [1, 1] }), { writes: ['pos'] }), subjects: ['x'] } as never);
  m.sync(FRAME);
  return m.probe('y', { pos: [0, 0] }).pos[0] === 0;
})();

for (const n of [1000, 10000]) {
  for (const k of KINDS) {
    group(`${k.kind} frame — ${n} nodes`, (bench) => {
      // Today's spring emits its start value on its first frame without
      // integrating, so it runs a frame behind blits' closed form, plus the
      // integrator's error: 5 units of a 500-unit swing.
      const tol = k.kind === 'tween' ? 1e-6 : 5;
      const today = mountAnimator();
      const tc = nodes(n);
      k.today(today.animator, tc);
      for (let f = 0; f < 30; f++) today.frame();
      bench('today', () => today.frame());

      for (const how of ['target', 'subjects'] as const) {
        if (how === 'target' ? n > TARGET_MAX : !HAS_SUBJECTS) continue;
        // A `target` mix holds ~800 MB at 1k nodes; a second copy runs out of heap.
        for (const lanes of how === 'target' ? [true] : [true, false]) {
          const pv = driven(n, k.perVoice(how), lanes ? undefined : NO_LANES);
          const out = { pos: [0, 0] };
          for (let f = 0; f < 30; f++) blitsFrame(pv.d, pv.c, out);
          agree(`${k.kind} voice per animation, ${how}`, tc.sink, pv.c.sink, tol);
          bench(`blits, voice per animation (${how})${lanes ? '' : ', lanes off'}`, () => blitsFrame(pv.d, pv.c, out));
        }
      }

      for (const [name, cue] of k.oneVoice) {
        for (const lanes of [true, false]) {
          const ov = driven(n, cue, lanes ? undefined : NO_LANES);
          const out = { pos: [0, 0] };
          for (let f = 0; f < 30; f++) blitsFrame(ov.d, ov.c, out);
          agree(`${k.kind} ${name}`, tc.sink, ov.c.sink, tol);
          bench(`blits, ${name}${lanes ? '' : ', lanes off'}`, () => blitsFrame(ov.d, ov.c, out));
        }
      }
    });
  }
}

for (const n of [100, 300, 1000, 10000]) {
  for (const k of KINDS) {
    group(`${k.kind} start + first frame — ${n} nodes`, (bench) => {
      bench('today', () => {
        const a = mountAnimator();
        k.today(a.animator, nodes(n));
        a.frame();
        a.unmount();
      });
      for (const how of ['target', 'subjects'] as const) {
        if (how === 'target' ? n > TARGET_MAX : !HAS_SUBJECTS) continue;
        bench(`blits, voice per animation (${how})`, () => {
          const { d, c } = driven(n, k.perVoice(how));
          blitsFrame(d, c, { pos: [0, 0] });
        });
      }
      for (const [name, cue] of k.oneVoice) {
        bench(`blits, ${name}`, () => {
          const { d, c } = driven(n, cue);
          blitsFrame(d, c, { pos: [0, 0] });
        });
      }
    }, { time: 0, iterations: 8, warmupIterations: 1 });
  }
}
