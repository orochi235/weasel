/**
 * Stateful test of a bus's insert chain on a fake context: adds at any index, moves, removes (repeated too),
 * bypasses, clears, re-adds of a used effect, crossfade rounds run one at a time or to the end, and dispose, on a
 * running or a suspended context. After every step the slots and their indices match a model of the chain, the
 * graph has a route from the bus input to its fader and no cycle, and no effect is disposed twice or while still
 * in the chain. Once the crossfades settle, the graph runs through exactly the model's effects in order, by
 * wet and dry routes and no others, and every effect taken out has been disposed once.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createBusGraph } from './buses';
import type { InsertEffect, InsertSlot, InsertChain } from './inserts';
import { createFakeAudioContext, type FakeNode } from './testing/fakeAudioContext';
import { allPaths, reachesCycle } from './testing/graphWalk';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 120;
const FADE = 20;

interface Fx { label: string; slot: InsertSlot; disposed: number }
interface Model { order: Fx[]; all: Fx[]; disposed: boolean }
interface Real {
  ctx: ReturnType<typeof createFakeAudioContext>;
  chain: InsertChain;
  dispose(): void;
  input: FakeNode;
  fader: FakeNode;
  labels: Map<FakeNode, string>;
  timers: Map<number, () => void>;
  fresh(label: string, onDispose: () => void): InsertEffect;
  effects: InsertEffect[];
}

const seen = tally();

function makeReal(running: boolean): Real {
  const ctx = createFakeAudioContext();
  if (running) ctx.state = 'running';
  const timers = new Map<number, () => void>();
  let nextId = 0;
  const graph = createBusGraph(ctx as never, ['sfx'], {
    fadeMs: FADE,
    setTimer: (cb) => { nextId += 1; timers.set(nextId, cb); return nextId; },
    clearTimer: (h) => { timers.delete(h as number); },
  });
  const labels = new Map<FakeNode, string>();
  return {
    ctx, timers, labels,
    chain: graph.bus('sfx').inserts,
    dispose: () => graph.dispose(),
    input: graph.input('sfx') as never as FakeNode,
    fader: graph.node('sfx') as never as FakeNode,
    effects: [],
    fresh(label, onDispose) {
      const n = ctx.createGain();
      labels.set(n, label);
      return { input: n as never, output: n as never, dispose: onDispose };
    },
  };
}

/** One round of the crossfades due, after the fade has passed on the audio clock. */
function step(r: Real): void {
  r.ctx._advance(FADE);
  const due = [...r.timers.values()];
  r.timers.clear();
  for (const f of due) f();
}

/** The labels on the route through the most effects: the chain's order, as a bypass only adds a route beside it. */
function graphOrder(r: Real): string[] {
  let best: string[] = [];
  for (const path of allPaths(r.input, r.fader)) {
    const got = path.flatMap((n) => r.labels.get(n) ?? []);
    if (got.length > best.length) best = got;
  }
  return best;
}

function check(m: Model, r: Real): void {
  expect(r.chain.slots()).toEqual(m.order.map((f) => f.slot));
  for (const f of m.all) {
    const at = m.order.indexOf(f);
    expect(f.slot.index()).toBe(at);
    expect(f.disposed).toBeLessThanOrEqual(1);
    if (at >= 0) expect(f.disposed).toBe(0);
  }
  expect(reachesCycle(r.input)).toBe(false);
  expect(allPaths(r.input, r.fader).length).toBeGreaterThan(0);
}

function checkSettled(m: Model, r: Real): void {
  expect(r.timers.size).toBe(0);
  expect(graphOrder(r)).toEqual(m.order.map((f) => f.label));
  expect(allPaths(r.input, r.fader)).toHaveLength(2 ** m.order.length);
  for (const f of m.all) expect(f.disposed).toBe(m.order.includes(f) ? 0 : 1);
  if (m.order.length >= 3) seen.count('long chain');
}

class Add implements fc.Command<Model, Real> {
  constructor(readonly index: number | undefined, readonly bypassed: boolean) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const label = `fx${m.all.length}`;
    const fx: Fx = { label, slot: null as never, disposed: 0 };
    const effect = r.fresh(label, () => { fx.disposed += 1; });
    const opts = { ...(this.index !== undefined ? { index: this.index } : {}), bypassed: this.bypassed };
    if (m.disposed) {
      expect(() => r.chain.add(effect, opts)).toThrow(/disposed/);
      return;
    }
    fx.slot = r.chain.add(effect, opts);
    r.effects.push(effect);
    m.all.push(fx);
    const at = Math.max(0, Math.min(this.index ?? m.order.length, m.order.length));
    m.order.splice(at, 0, fx);
    expect(fx.slot.bypassed()).toBe(this.bypassed);
    check(m, r);
  }
  toString = () => `add(${this.index}, ${this.bypassed})`;
}

class AddAgain implements fc.Command<Model, Real> {
  constructor(readonly pick: number) {}
  check = (m: Readonly<Model>) => m.all.length > 0 && !m.disposed;
  run(m: Model, r: Real): void {
    const i = this.pick % m.all.length;
    expect(() => r.chain.add(r.effects[i]!)).toThrow(/already/);
    check(m, r);
  }
  toString = () => `addAgain(#${this.pick})`;
}

class Move implements fc.Command<Model, Real> {
  constructor(readonly pick: number, readonly to: number) {}
  check = (m: Readonly<Model>) => m.all.length > 0;
  run(m: Model, r: Real): void {
    const fx = m.all[this.pick % m.all.length]!;
    fx.slot.moveTo(this.to);
    const from = m.order.indexOf(fx);
    if (from >= 0) {
      m.order.splice(from, 1);
      m.order.splice(Math.max(0, Math.min(this.to, m.order.length)), 0, fx);
      seen.count('moved');
    }
    check(m, r);
  }
  toString = () => `move(#${this.pick}, ${this.to})`;
}

class Remove implements fc.Command<Model, Real> {
  constructor(readonly pick: number) {}
  check = (m: Readonly<Model>) => m.all.length > 0;
  run(m: Model, r: Real): void {
    const fx = m.all[this.pick % m.all.length]!;
    fx.slot.remove();
    const at = m.order.indexOf(fx);
    if (at >= 0) m.order.splice(at, 1);
    else seen.count('removed again');
    check(m, r);
  }
  toString = () => `remove(#${this.pick})`;
}

class Bypass implements fc.Command<Model, Real> {
  constructor(readonly pick: number, readonly on: boolean) {}
  check = (m: Readonly<Model>) => m.all.length > 0;
  run(m: Model, r: Real): void {
    const fx = m.all[this.pick % m.all.length]!;
    fx.slot.bypass(this.on);
    expect(fx.slot.bypassed()).toBe(this.on);
    check(m, r);
  }
  toString = () => `bypass(#${this.pick}, ${this.on})`;
}

class Clear implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void {
    r.chain.clear();
    m.order = [];
    check(m, r);
  }
  toString = () => 'clear';
}

class Step implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void {
    if (r.timers.size > 0) seen.count('mid-fade');
    step(r);
    check(m, r);
  }
  toString = () => 'step';
}

class Settle implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void {
    for (let i = 0; i < 200 && r.timers.size > 0; i += 1) step(r);
    check(m, r);
    checkSettled(m, r);
  }
  toString = () => 'settle';
}

class Dispose implements fc.Command<Model, Real> {
  check = (m: Readonly<Model>) => !m.disposed;
  run(m: Model, r: Real): void {
    r.dispose();
    m.disposed = true;
    m.order = [];
    expect(r.timers.size).toBe(0);
    check(m, r);
    checkSettled(m, r);
    seen.count('disposed');
  }
  toString = () => 'dispose';
}

const index = fc.option(fc.integer({ min: -2, max: 6 }), { nil: undefined });
const commands = fc.commands([
  ...[1, 2, 3].map(() => fc.tuple(index, fc.boolean()).map(([i, b]) => new Add(i, b))),
  fc.nat().map((p) => new AddAgain(p)),
  ...[1, 2].map(() => fc.tuple(fc.nat(), fc.integer({ min: -2, max: 6 })).map(([p, to]) => new Move(p, to))),
  fc.nat().map((p) => new Remove(p)),
  fc.tuple(fc.nat(), fc.boolean()).map(([p, on]) => new Bypass(p, on)),
  fc.constant(new Clear()),
  ...[1, 2, 3].map(() => fc.constant(new Step())),
  fc.constant(new Settle()),
  fc.constant(new Dispose()),
], { maxCommands: 40, size: '+1' });

describe('insert chain', () => {
  it('follows its model through any edits, mid-fade or settled, and disposes each effect once', () => {
    fc.assert(fc.property(fc.boolean(), commands, (running, cmds) => {
      const model: Model = { order: [], all: [], disposed: false };
      const real = makeReal(running);
      fc.modelRun(() => ({ model, real }), cmds);
      new Settle().run(model, real);
    }), runs(RUNS));
    for (const what of ['moved', 'removed again', 'mid-fade', 'long chain', 'disposed']) seen.atLeast(what, RUNS / 10);
  }, timeoutFor(RUNS, 40));
});
