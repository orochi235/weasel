/**
 * Stateful property test of the trim override registry on a hosted animator: `set`, `clear`,
 * `clearAll`, `release`, bare commits to an edge's target, and linear tweens on it, against a plain
 * model of each node's overrides and each edge's committed value and moves.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { TrimEdge, TrimOverride, TrimOverrideRegistry } from './trimRegistry';
import { clocked, runs, tally, timeoutFor } from './pbt.fixture';

const IDS = ['a', 'b'] as const;
const EDGES: readonly TrimEdge[] = ['start', 'end'];

interface Move { from: number; to: number; at: number; ms: number }
interface Slot { value: number; painted: boolean; moves: Move[] }
interface Model { sets: Map<string, TrimOverride>; slots: Map<string, Slot>; now: number }
interface Real { h: ReturnType<typeof clocked>; reg: TrimOverrideRegistry; now: number }

const key = (id: string, edge: TrimEdge): string => `${id}:${edge}`;
const live = (m: Readonly<Model>, s: Slot): Move[] => s.moves.filter((mv) => m.now - mv.at < mv.ms);
const readOf = (m: Readonly<Model>, s: Slot): number =>
  s.value + live(m, s).reduce((sum, mv) => sum + (mv.from - mv.to) * (1 - (m.now - mv.at) / mv.ms), 0);

function resolve(m: Model, id: string): TrimOverride | undefined {
  const out: TrimOverride = {};
  for (const edge of EDGES) {
    const set = m.sets.get(id)?.[edge];
    const s = m.slots.get(key(id, edge));
    const painted = s?.painted === true;
    const v = set === undefined ? (painted ? readOf(m, s!) : undefined)
      : painted && live(m, s!).length > 0 ? set + readOf(m, s!) - s!.value : set;
    if (v !== undefined) out[edge] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function release(m: Model, id: string, edge: TrimEdge): void {
  const s = m.slots.get(key(id, edge));
  if (s && live(m, s).length === 0) m.slots.delete(key(id, edge));
}

const tl = tally();

function check(m: Model, r: Real): void {
  for (const id of IDS) {
    const want = resolve(m, id);
    const got = r.reg.get(id);
    if (want === undefined) expect(got).toBeUndefined();
    else {
      expect(Object.keys(got ?? {}).sort()).toEqual(Object.keys(want).sort());
      for (const edge of EDGES) if (want[edge] !== undefined) expect(got![edge]).toBeCloseTo(want[edge]!, 6);
    }
    const painted = EDGES.some((e) => m.slots.get(key(id, e))?.painted);
    expect(r.reg.has(id)).toBe(m.sets.has(id) || painted);
  }
}

type Cmd = fc.Command<Model, Real>;
const cmd = (name: string, run: (m: Model, r: Real) => void, guard: (m: Readonly<Model>) => boolean = () => true): Cmd => ({
  check: guard,
  run(m, r) { run(m, r); tl.count(name.split('(')[0]!); check(m, r); },
  toString: () => name,
});

const id = fc.constantFrom(...IDS);
const edge = fc.constantFrom(...EDGES);
const frac = fc.oneof(fc.constantFrom(0, 0.25, 0.5, 1), fc.double({ min: -0.5, max: 1.5, noNaN: true }));
const override = fc.record({ start: frac, end: frac }, { requiredKeys: [] });

const slotOf = (m: Model, id: string, e: TrimEdge): Slot => {
  let s = m.slots.get(key(id, e));
  if (!s) m.slots.set(key(id, e), (s = { value: e === 'start' ? 0 : 1, painted: false, moves: [] }));
  return s;
};

const commands = [
  fc.tuple(id, override).map(([i, o]) => cmd(`set(${i}, ${JSON.stringify(o)})`, (m, r) => {
    m.sets.set(i, { ...o });
    r.reg.set(i, o);
  })),
  id.map((i) => cmd(`clear(${i})`, (m, r) => {
    for (const e of EDGES) release(m, i, e);
    m.sets.delete(i);
    r.reg.clear(i);
  })),
  fc.constant(cmd('clearAll', (m, r) => {
    for (const i of IDS) for (const e of EDGES) release(m, i, e);
    m.sets.clear();
    r.reg.clearAll();
  })),
  fc.tuple(id, edge).map(([i, e]) => cmd(`release(${i}, ${e})`, (m, r) => {
    release(m, i, e);
    r.reg.release(i, e);
  })),
  fc.tuple(id, edge, frac).map(([i, e, v]) => cmd(`commit(${i}, ${e}, ${v})`, (m, r) => {
    const s = slotOf(m, i, e);
    s.value = v;
    s.painted = true;
    r.reg.target(i, e).commit(v);
  })),
  fc.tuple(id, edge, frac, fc.integer({ min: 1, max: 200 })).map(([i, e, v, ms]) => cmd(`tween(${i}, ${e}, ${v}, ${ms})`, (m, r) => {
    const s = slotOf(m, i, e);
    s.moves.push({ from: s.value, to: v, at: m.now, ms });
    s.value = v;
    s.painted = true;
    r.h.animator.tween({ target: r.reg.target(i, e), to: v, ms, easing: 'linear' });
  })),
  fc.integer({ min: 0, max: 80 }).map((dt) => cmd(`frame(${dt})`, (m, r) => {
    m.now += dt;
    r.now += dt;
    r.h.at(r.now);
  })),
];

const RUNS = 200;

describe('TrimOverrideRegistry, stateful', () => {
  it('paints what a plain model of its overrides, commits, and moves says', () => {
    fc.assert(fc.property(fc.commands(commands, { maxCommands: 40, size: 'medium' }), (cmds) => {
      const h = clocked();
      h.at(0);
      const real: Real = { h, reg: h.animator.trimOverrides, now: 0 };
      fc.modelRun(() => ({ model: { sets: new Map(), slots: new Map(), now: 0 }, real }), cmds);
    }), runs(RUNS));
    for (const name of ['set', 'clear', 'release', 'commit', 'tween', 'frame']) tl.atLeast(name, 100);
  }, timeoutFor(RUNS, 40));
});
