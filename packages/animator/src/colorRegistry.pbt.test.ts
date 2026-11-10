/**
 * Stateful property test of the color override registry on a hosted animator: array and function
 * overrides, `clear`, `clearAll`, `release`, bare commits and linear tweens on targets of two
 * lengths, against a plain model; every step checks `get`, `has`, and `resolve` over bases of each
 * length and none.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ColorOverride, ColorOverrideRegistry, VertexColorChannel } from './colorRegistry';
import { clocked, runs, tally, timeoutFor } from './pbt.fixture';

const IDS = ['a', 'b'] as const;
const CHANNELS: readonly VertexColorChannel[] = ['fill', 'stroke'];
const LENGTHS = [4, 8] as const;
const BASES: (readonly number[] | undefined)[] = [undefined, [0.1, 0.2, 0.3, 0.4], [0.5, 0.5, 0.5, 1, 0, 0, 0, 1]];

interface Move { from: number[]; to: number[]; at: number; ms: number }
interface Slot { length: number; value: number[]; painted: boolean; moves: Move[] }
interface Model { sets: Map<string, ColorOverride>; slots: Map<string, Slot>; now: number }
interface Real { h: ReturnType<typeof clocked>; reg: ColorOverrideRegistry; now: number }

const key = (id: string, ch: VertexColorChannel): string => `${id}:${ch}`;
const live = (m: Readonly<Model>, s: Slot): Move[] => s.moves.filter((mv) => m.now - mv.at < mv.ms);
const readOf = (m: Readonly<Model>, s: Slot): number[] => s.value.map((v, i) =>
  v + live(m, s).reduce((sum, mv) => sum + (mv.from[i]! - mv.to[i]!) * (1 - (m.now - mv.at) / mv.ms), 0));

function resolve(m: Model, id: string, ch: VertexColorChannel, base: readonly number[] | undefined, t: number): readonly number[] | undefined {
  const o = m.sets.get(key(id, ch));
  const s = m.slots.get(key(id, ch));
  if (o === undefined) return s?.painted ? readOf(m, s) : base;
  let under: readonly number[] | undefined;
  if (typeof o === 'function') {
    under = base === undefined ? undefined : o(base, t);
    if (base !== undefined && under!.length !== base.length) under = base;
  } else under = o;
  if (!s?.painted || under?.length !== s.length || live(m, s).length === 0) return under;
  const shown = readOf(m, s);
  return under.map((x, i) => x + shown[i]! - s.value[i]!);
}

function release(m: Model, id: string, ch: VertexColorChannel): void {
  const s = m.slots.get(key(id, ch));
  if (s && live(m, s).length === 0) m.slots.delete(key(id, ch));
}

const near = (got: readonly number[] | undefined, want: readonly number[] | undefined): void => {
  if (want === undefined) { expect(got).toBeUndefined(); return; }
  expect(got).toHaveLength(want.length);
  want.forEach((w, i) => expect(got![i]).toBeCloseTo(w, 6));
};

const tl = tally();

function check(m: Model, r: Real): void {
  for (const id of IDS) {
    for (const ch of CHANNELS) {
      for (const base of BASES) near(r.reg.resolve(id, ch, base, m.now), resolve(m, id, ch, base, m.now));
      const o = m.sets.get(key(id, ch));
      const s = m.slots.get(key(id, ch));
      const got = r.reg.get(id, ch);
      if (typeof o === 'function') expect(got).toBe(o);
      else near(got as readonly number[] | undefined, o ?? (s?.painted ? readOf(m, s) : undefined));
    }
    const painted = CHANNELS.some((c) => m.slots.get(key(id, c))?.painted);
    expect(r.reg.has(id)).toBe(CHANNELS.some((c) => m.sets.has(key(id, c))) || painted);
  }
}

type Cmd = fc.Command<Model, Real>;
const cmd = (name: string, run: (m: Model, r: Real) => void): Cmd => ({
  check: () => true,
  run(m, r) { run(m, r); tl.count(name.split('(')[0]!); check(m, r); },
  toString: () => name,
});

/** The target for `id`'s `ch` at `length` in the model, or null where the real one throws. */
function slotOf(m: Model, id: string, ch: VertexColorChannel, length: number): Slot | null {
  const held = m.slots.get(key(id, ch));
  if (held?.length === length) return held;
  if (held && live(m, held).length > 0) return null;
  const s: Slot = { length, value: new Array<number>(length).fill(0), painted: false, moves: [] };
  m.slots.set(key(id, ch), s);
  return s;
}

const id = fc.constantFrom(...IDS);
const ch = fc.constantFrom(...CHANNELS);
const len = fc.constantFrom(...LENGTHS);
const colors = (n: number) => fc.array(fc.constantFrom(0, 0.25, 0.5, 1), { minLength: n, maxLength: n });
const halve = (base: readonly number[], t: number): number[] => base.map((x) => x / 2 + (t % 2) * 0);
const short = (): number[] => [1, 1, 1, 1];

const commands = [
  fc.tuple(id, ch, len.chain(colors)).map(([i, c, v]) => cmd(`set(${i}, ${c}, [${v.length}])`, (m, r) => {
    m.sets.set(key(i, c), v);
    r.reg.set(i, c, v);
  })),
  fc.tuple(id, ch, fc.constantFrom(halve, short)).map(([i, c, f]) => cmd(`setFn(${i}, ${c}, ${f.name})`, (m, r) => {
    m.sets.set(key(i, c), f);
    r.reg.set(i, c, f);
  })),
  fc.tuple(id, ch).map(([i, c]) => cmd(`clear(${i}, ${c})`, (m, r) => {
    release(m, i, c);
    m.sets.delete(key(i, c));
    r.reg.clear(i, c);
  })),
  fc.constant(cmd('clearAll', (m, r) => {
    for (const i of IDS) for (const c of CHANNELS) release(m, i, c);
    m.sets.clear();
    r.reg.clearAll();
  })),
  fc.tuple(id, ch).map(([i, c]) => cmd(`release(${i}, ${c})`, (m, r) => {
    release(m, i, c);
    r.reg.release(i, c);
  })),
  fc.tuple(id, ch, len.chain((n) => colors(n))).map(([i, c, v]) => cmd(`commit(${i}, ${c}, [${v}])`, (m, r) => {
    const s = slotOf(m, i, c, v.length);
    if (!s) { expect(() => r.reg.target(i, c, v.length)).toThrow(/is moving as/); tl.count('refused'); return; }
    s.value = v.slice();
    s.painted = true;
    r.reg.target(i, c, v.length).commit(v.slice());
  })),
  fc.tuple(id, ch, len.chain((n) => colors(n)), fc.integer({ min: 1, max: 200 })).map(([i, c, v, ms]) => cmd(`tween(${i}, ${c}, [${v}], ${ms})`, (m, r) => {
    const s = slotOf(m, i, c, v.length);
    if (!s) { expect(() => r.reg.target(i, c, v.length)).toThrow(/is moving as/); tl.count('refused'); return; }
    s.moves.push({ from: s.value.slice(), to: v.slice(), at: m.now, ms });
    s.value = v.slice();
    s.painted = true;
    r.h.animator.tween({ target: r.reg.target(i, c, v.length), to: v.slice(), ms, easing: 'linear' });
  })),
  fc.integer({ min: 0, max: 80 }).map((dt) => cmd(`frame(${dt})`, (m, r) => {
    m.now += dt;
    r.now += dt;
    r.h.at(r.now);
  })),
];

const RUNS = 150;

describe('ColorOverrideRegistry, stateful', () => {
  it('paints what a plain model of its overrides, commits, and moves says', () => {
    fc.assert(fc.property(fc.commands(commands, { maxCommands: 40, size: 'medium' }), (cmds) => {
      const h = clocked();
      h.at(0);
      const real: Real = { h, reg: h.animator.colorOverrides, now: 0 };
      fc.modelRun(() => ({ model: { sets: new Map(), slots: new Map(), now: 0 }, real }), cmds);
    }), runs(RUNS));
    for (const name of ['set', 'setFn', 'clear', 'release', 'commit', 'tween', 'frame']) tl.atLeast(name, 100);
    tl.atLeast('refused', 5);
  }, timeoutFor(RUNS, 60));
});
