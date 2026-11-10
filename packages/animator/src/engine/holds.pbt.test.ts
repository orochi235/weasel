/**
 * Stateful property test of holds on one target: random holds of any weight over some of its axes,
 * releases that commit or do not, commits under them, and frames, against a model that folds the
 * holds per axis as `animator.hold` documents: each hold weighs `w / max(1, total)`, and what the
 * weights leave short of 1 is the committed value's. A release that commits keeps what shows.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createTarget, type Target } from '../target';
import type { HoldHandle } from '../targetTypes';
import { clocked, runs, tally, timeoutFor } from '../pbt.fixture';

type V = { x: number; y: number };
const AXES = ['x', 'y'] as const;

interface ModelHold { value: V; weight: number; axes: readonly ('x' | 'y')[] }
interface ModelTween { from: V; to: V; start: number; ms: number }
interface Model { committed: V; holds: (ModelHold | null)[]; tweens: ModelTween[]; now: number }
interface Real {
  h: ReturnType<typeof clocked>;
  target: Target<V>;
  committed: V;
  handles: (HoldHandle | null)[];
  now: number;
}

const share = (w: number): number => (w > 0 ? Math.min(w, 1) : 0);

function shown(m: Model): V {
  const out = { ...m.committed };
  for (const a of AXES) {
    const on = m.holds.filter((h): h is ModelHold => h !== null && h.axes.includes(a) && share(h.weight) > 0);
    const total = on.reduce((s, h) => s + share(h.weight), 0);
    const c = m.committed[a];
    const left = m.tweens.reduce((s, t) => s + (t.from[a] - t.to[a]) * (1 - Math.min(1, (m.now - t.start) / t.ms)), 0);
    out[a] = c + on.reduce((s, h) => s + share(h.weight) * (h.value[a] - c), 0) / Math.max(1, total) + (1 - Math.min(1, total)) * left;
  }
  return out;
}

const moving = (m: Readonly<Model>): boolean => m.tweens.some((t) => m.now - t.start < t.ms);

const tl = tally();

function check(m: Model, r: Real): void {
  const want = shown(m);
  const got = r.target.read();
  for (const a of AXES) {
    expect(got[a]).toBeCloseTo(want[a], 6);
    expect(r.committed[a]).toBeCloseTo(m.committed[a], 6);
  }
}

const num = fc.integer({ min: -500, max: 500 });
const point = fc.record({ x: num, y: num });
const weight = fc.oneof(fc.constantFrom(0, 0.25, 0.5, 1, 1.5, -1), fc.double({ min: 0, max: 2, noNaN: true }));
const axes = fc.constantFrom<readonly ('x' | 'y')[]>(['x', 'y'], ['x'], ['y']);

class Hold implements fc.Command<Model, Real> {
  constructor(readonly value: V, readonly weight: number, readonly axes: readonly ('x' | 'y')[]) {}
  check = () => true;
  run(m: Model, r: Real): void {
    m.holds.push({ value: this.value, weight: this.weight, axes: this.axes });
    r.handles.push(r.h.animator.hold({ target: r.target, value: this.value, weight: this.weight, axes: [...this.axes] }));
    tl.count('hold');
    check(m, r);
  }
  toString = () => `hold(${JSON.stringify(this.value)}, ${this.weight}, ${this.axes.join('')})`;
}

class Release implements fc.Command<Model, Real> {
  constructor(readonly pick: number, readonly commit: boolean) {}
  // A release that commits under a move hands it a share of the move, which the model leaves out.
  check = (m: Readonly<Model>) => m.holds.some((h) => h !== null) && !(this.commit && moving(m));
  run(m: Model, r: Real): void {
    const live = m.holds.flatMap((h, i) => (h ? [i] : []));
    const i = live[this.pick % live.length]!;
    const hold = m.holds[i]!;
    const at = shown(m);
    m.holds[i] = null;
    if (this.commit) {
      // The committed value moves so what shows stays; under holds that cover it outright it takes this one's, if it weighed anything.
      for (const a of hold.axes) {
        const rest = m.holds.filter((h): h is ModelHold => h !== null && h.axes.includes(a));
        const total = rest.reduce((s, h) => s + share(h.weight), 0);
        const pulled = rest.reduce((s, h) => s + share(h.weight) * h.value[a], 0);
        if (total < 1 - 1e-9) m.committed[a] = (at[a] - pulled) / (1 - total);
        else if (share(hold.weight) > 0) m.committed[a] = hold.value[a];
      }
      tl.count('release, committing');
    }
    r.handles[i]!.release({ commit: this.commit });
    r.handles[i] = null;
    check(m, r);
  }
  toString = () => `release(${this.pick}, ${this.commit})`;
}

class Commit implements fc.Command<Model, Real> {
  constructor(readonly value: V) {}
  check = () => true;
  run(m: Model, r: Real): void {
    m.committed = { ...this.value };
    r.target.commit({ ...this.value });
    if (m.holds.some((h) => h !== null)) tl.count('commit under holds');
    check(m, r);
  }
  toString = () => `commit(${JSON.stringify(this.value)})`;
}

class Tween implements fc.Command<Model, Real> {
  constructor(readonly to: V, readonly ms: number) {}
  check = () => true;
  run(m: Model, r: Real): void {
    m.tweens.push({ from: { ...m.committed }, to: this.to, start: m.now, ms: this.ms });
    m.committed = { ...this.to };
    r.h.animator.tween({ target: r.target, to: { ...this.to }, ms: this.ms, easing: 'linear' });
    if (m.holds.some((h) => h !== null)) tl.count('tween under holds');
    check(m, r);
  }
  toString = () => `tween(${JSON.stringify(this.to)}, ${this.ms})`;
}

class Frame implements fc.Command<Model, Real> {
  constructor(readonly dt: number) {}
  check = () => true;
  run(m: Model, r: Real): void {
    m.now += this.dt;
    r.now += this.dt;
    r.h.at(r.now);
    check(m, r);
  }
  toString = () => `frame(${this.dt})`;
}

const commands = [
  fc.tuple(point, weight, axes).map(([v, w, a]) => new Hold(v, w, a)),
  fc.tuple(fc.nat(8), fc.boolean()).map(([p, c]) => new Release(p, c)),
  point.map((v) => new Commit(v)),
  fc.integer({ min: 0, max: 50 }).map((dt) => new Frame(dt)),
];

const withTweens = [...commands, fc.tuple(point, fc.integer({ min: 1, max: 200 })).map(([to, ms]) => new Tween(to, ms))];

const RUNS = 200;

function start(p: V): { model: Model; real: Real } {
  const model: Model = { committed: { ...p }, holds: [], tweens: [], now: 0 };
  const real: Real = { h: clocked(), target: null as unknown as Target<V>, committed: { ...p }, handles: [], now: 0 };
  real.target = createTarget<V>({ get: () => real.committed, set: (v) => { real.committed = { ...v }; } });
  real.h.at(0);
  return { model, real };
}

describe('holds on one target, stateful', () => {
  it('show the committed value folded with every hold by weight, axis by axis', () => {
    fc.assert(fc.property(point, fc.commands(commands, { maxCommands: 30 }), (p, cmds) => {
      const s = start(p);
      fc.modelRun(() => s, cmds);
    }), runs(RUNS));
    tl.atLeast('hold', 100);
    tl.atLeast('release, committing', 30);
    tl.atLeast('commit under holds', 30);
  }, timeoutFor(RUNS, 30));

  it('cover the moves of tweens by their weights, and show the rest of each', () => {
    fc.assert(fc.property(point, fc.commands(withTweens, { maxCommands: 30 }), (p, cmds) => {
      const s = start(p);
      fc.modelRun(() => s, cmds);
    }), runs(RUNS));
    tl.atLeast('tween under holds', 50);
  }, timeoutFor(RUNS, 30));
});
