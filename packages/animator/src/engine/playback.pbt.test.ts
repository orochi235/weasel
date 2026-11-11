/**
 * Linear tweens on a hosted animator against a model of each one's own clock, through long runs
 * of frames, pauses, time scales either way, cancels by handle and by key, hidden-tab gaps, and
 * handlers that cancel or start tweens while the animator is notifying them.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { AnimationHandle } from '../types';
import { clocked, runs, tally, timeoutFor } from '../pbt.fixture';

const RUNS = 150;
const KEYS = ['a', 'b', '__proto__', 'constructor', 'toString'] as const;
type Key = (typeof KEYS)[number];

interface Spec { from: number; to: number; ms: number; key?: Key; cancels?: Key; chains: boolean }
interface Tw extends Spec {
  /** Its own clock, in virtual ms. */
  clock: number;
  paused: boolean; scale: number;
  live: boolean; done: number; ticks: number; last: number;
  handle: AnimationHandle;
}
interface World {
  h: ReturnType<typeof clocked>;
  now: number;
  paused: boolean; scale: number;
  tws: Tw[];
  /** Follow-ups an `onDone` started this frame, which first tick on the next. */
  fresh: Set<Tw>;
}

const lerp = (t: Tw): number => (t.clock <= 0 ? t.from : t.clock >= t.ms ? t.to : t.from + ((t.to - t.from) * t.clock) / t.ms);
const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));

function launch(w: World, spec: Spec): Tw {
  for (const o of w.tws) if (o.live && spec.key !== undefined && o.key === spec.key) o.live = false;
  const tw = { ...spec, clock: 0, paused: false, scale: 1, live: true, done: 0, ticks: 0, last: Number.NaN } as Tw;
  w.tws.push(tw);
  tw.handle = w.h.animator.tween({
    from: spec.from, to: spec.to, ms: spec.ms, easing: 'linear', cancelKey: spec.key,
    onTick: (v) => {
      tw.last = v;
      tw.ticks++;
      if (tw.ticks === 1 && tw.cancels !== undefined) w.h.animator.cancelKey(tw.cancels);
    },
    onDone: () => {
      tw.done++;
      if (tw.chains) w.fresh.add(launch(w, { from: spec.to, to: spec.from, ms: spec.ms, chains: false }));
    },
  });
  return tw;
}

/** The model's frame of `dt`: each tween live as it began moves its clock, in the order they started. */
function frame(w: World, dt: number, ended: Tw[]): void {
  const sign = w.scale < 0 ? -1 : 1;
  for (const t of w.tws.filter((x) => x.live)) {
    if (!t.live) continue;
    const rate = w.paused || t.paused ? 0 : Math.abs(w.scale) * t.scale * sign;
    t.clock += dt * rate;
    if (t.ticks === 0 && t.cancels !== undefined) for (const o of w.tws) if (o.live && o.key === t.cancels) o.live = false;
    if ((rate < 0 && t.clock <= 0) || t.clock >= t.ms) {
      if (t.live) ended.push(t);
      t.live = false;
    }
  }
}

type Cmd = fc.Command<World, World>;
const cmd = (name: string, run: (w: World) => void): Cmd => ({ check: () => true, run: (_m, w) => run(w), toString: () => name });

function check(w: World, t: ReturnType<typeof tally>): void {
  for (const tw of w.tws) {
    expect(tw.done).toBeLessThanOrEqual(1);
    if (Number.isFinite(tw.last)) continue;
    expect(tw.ticks).toBe(0);
  }
  expect(w.h.animator.isActive()).toBe(w.tws.some((x) => x.live));
  const rows = new Map(w.h.animator.live().map((r) => [r.id, r]));
  for (const tw of w.tws.filter((x) => x.live)) {
    const row = rows.get(tw.handle.id)!;
    expect(close(row.elapsed, tw.clock), `clock ${row.elapsed} vs ${tw.clock}`).toBe(true);
    expect(row.paused).toBe(tw.paused);
    expect(row.timeScale).toBe(tw.scale);
  }
  expect(rows.size).toBe(w.tws.filter((x) => x.live).length);
  for (const k of KEYS) expect(w.h.animator.isActive(k), k).toBe(w.tws.some((x) => x.live && x.key === k));
  if (w.tws.filter((x) => x.live).length > 2) t.count('crowded');
}

const spec: fc.Arbitrary<Spec> = fc.record({
  from: fc.integer({ min: -500, max: 500 }), to: fc.integer({ min: -500, max: 500 }), ms: fc.integer({ min: 1, max: 600 }),
  key: fc.option(fc.constantFrom(...KEYS), { nil: undefined }),
  cancels: fc.option(fc.constantFrom(...KEYS), { nil: undefined, freq: 4 }),
  chains: fc.boolean(),
}, { requiredKeys: ['from', 'to', 'ms', 'chains'] });
const scale = fc.constantFrom(-2, -1, -0.5, 0, 0.5, 1, 2);

/** A frame `real` ms on, which the model charges `charged` of. */
function step(w: World, t: ReturnType<typeof tally>, charged: number, real: number): void {
  const before = w.tws.map((x) => x.ticks);
  const ended: Tw[] = [];
  w.fresh.clear();
  frame(w, charged, ended);
  w.now += real;
  w.h.at(w.now);
  w.tws.forEach((x, i) => {
    if ((before[i] ?? 0) === x.ticks || w.fresh.has(x)) return;
    if (ended.includes(x)) {
      expect(x.done, 'ended').toBe(1);
      expect(x.last).toBe(x.clock <= 0 ? x.from : x.to);
      t.count('ended');
    } else if (x.live) {
      expect(close(x.last, lerp(x)), `${x.last} vs ${lerp(x)} at ${x.clock}/${x.ms}`).toBe(true);
      if (x.clock > 0 && x.clock < x.ms) t.count('midway');
    }
  });
  check(w, t);
}

function commands(t: ReturnType<typeof tally>): fc.Arbitrary<Cmd>[] {
  /** One of the live tweens mostly, and now and then one that has left. */
  const pick = (w: World, i: number): Tw | undefined => {
    const live = w.tws.filter((x) => x.live);
    const from = live.length > 0 && i % 5 !== 0 ? live : w.tws;
    return from[i % Math.max(1, from.length)];
  };
  const frameCmd = fc.integer({ min: 0, max: 120 }).map((dt) => cmd(`frame(${dt})`, (w) => step(w, t, dt, dt)));
  const launchCmd = spec.map((s) => cmd(`launch(${JSON.stringify(s)})`, (w) => { launch(w, s); check(w, t); }));
  return [
    frameCmd, frameCmd, frameCmd, frameCmd, launchCmd, launchCmd, launchCmd,
    fc.nat().map((i) => cmd(`cancel(${i})`, (w) => { const x = pick(w, i); if (!x) return; x.handle.cancel(); x.live = false; check(w, t); })),
    fc.constantFrom(...KEYS).map((k) => cmd(`cancelKey(${k})`, (w) => {
      w.h.animator.cancelKey(k);
      for (const x of w.tws) if (x.key === k) x.live = false;
      check(w, t);
    })),
    fc.boolean().map((p) => cmd(p ? 'pause' : 'resume', (w) => {
      if (p) w.h.animator.pause(); else w.h.animator.resume();
      w.paused = p;
    })),
    scale.map((s) => cmd(`setTimeScale(${s})`, (w) => { w.h.animator.setTimeScale(s); w.scale = s; if (s < 0) t.count('backward'); })),
    fc.tuple(fc.nat(), scale, fc.boolean()).map(([i, s, p]) => cmd(`handle(${i}, ${s}, ${p})`, (w) => {
      const x = pick(w, i);
      if (!x) return;
      x.handle.setTimeScale(s);
      if (p) x.handle.pause(); else x.handle.resume();
      if (x.live) { x.scale = s; x.paused = p; t.count('scaled live'); }
      if (x.live) expect(x.handle.timeScale()).toBe(s);
    })),
    fc.tuple(fc.oneof(fc.integer({ min: 1, max: 3_600_000 }), fc.constant(1e15)), fc.option(spec, { nil: undefined })).map(([gap, s]) => cmd(`hidden(${gap}, ${JSON.stringify(s)})`, (w) => {
      w.h.suspended();
      // A handler that runs while the tab is hidden may start one.
      if (s) launch(w, s);
      w.h.resumed();
      step(w, t, 0, gap);
      t.count('hidden');
    })),
    fc.constant(cmd('cancelAll', (w) => { w.h.animator.cancelAll(); for (const x of w.tws) x.live = false; check(w, t); })),
  ];
}

describe('animator playback, stateful property', () => {
  it('keeps each tween at the value its own clock gives, through any mix of frames, scales, pauses, and cancels', () => {
    const t = tally();
    fc.assert(fc.property(fc.commands(commands(t), { maxCommands: 80, size: 'large' }), (cmds) => {
      const h = clocked();
      h.at(0);
      const w: World = { h, now: 0, paused: false, scale: 1, tws: [], fresh: new Set() };
      fc.modelRun(() => ({ model: w, real: w }), cmds);
    }), runs(RUNS));
    t.atLeast('midway', 100);
    t.atLeast('ended', 50);
    t.atLeast('backward', 50);
    t.atLeast('hidden', 30);
    t.atLeast('crowded', 30);
    t.atLeast('scaled live', 200);
  }, timeoutFor(RUNS, 40));
});
