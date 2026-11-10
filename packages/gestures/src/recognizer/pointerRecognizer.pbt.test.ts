/**
 * Stateful property test of the pointer recognizer: random presses, moves, releases, and cancels of several
 * pointers of each type, clock advances, `takeHold`, and `reset`, against a model of what it holds. Every step
 * checks the exact events dispatched, then the held pointers, the pending hold, and that no event carries a
 * non-finite number.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { EventModifiers, InputEvent } from '../ui/inputEvent';
import { NO_MODS, fakeClock, modifiers, nonFinite, runs, timeoutFor } from '../pbt.fixture';
import type { HeldPress } from './longPressHold';
import { createPointerRecognizer, type PointerRecognizer } from './pointerRecognizer';
import * as model from './recognizerModel.fixture';
import type { Config, Expected, Model, SampleIn } from './recognizerModel.fixture';

const RUNS = 150;

interface Real {
  rec: PointerRecognizer;
  clock: ReturnType<typeof fakeClock>;
  events: InputEvent[];
  holds: (HeldPress | null)[];
}

const tally = new Map<string, number>();
const count = (events: readonly InputEvent[]): void => {
  for (const e of events) {
    const name = e.kind === 'pointerdown' ? (e.stage ? 'press' : 'drag')
      : e.kind === 'multitouch' ? `multitouch:${e.end ?? 'geometry'}` : e.kind;
    tally.set(name, (tally.get(name) ?? 0) + 1);
  }
};

function makeReal(cfg: Config): Real {
  const clock = fakeClock();
  const events: InputEvent[] = [];
  const holds: (HeldPress | null)[] = [];
  const rec = createPointerRecognizer({
    clock,
    toWorld: model.toWorld,
    sink: {
      dispatch: (ev) => { events.push(ev); return cfg.handles.includes(ev.kind) ? 'handled' : 'unhandled'; },
      multiTouchInFlight: (n) => cfg.inFlight.includes(n),
    },
    observer: { holdChanged: (p) => { holds.push(p); } },
    dragPx: () => cfg.dragPx,
    longPressMs: () => cfg.longPressMs,
    doubleClickMs: () => cfg.doubleClickMs,
    doubleClickPx: () => cfg.doubleClickPx,
    tapPx: () => cfg.tapPx,
  });
  return { rec, clock, events, holds };
}

/** Run `act` on the recognizer and check it dispatched exactly `expected`, then the state both share. */
function step(m: Model, r: Real, expected: Expected[], act: () => void): void {
  const from = r.events.length;
  act();
  const got = r.events.slice(from);
  count(got);
  expect(got).toMatchObject(expected);
  got.forEach((e, i) => { expect('stage' in e).toBe('stage' in expected[i]!); });
  expect(got.flatMap((e) => nonFinite(e))).toEqual([]);
  expect(r.rec.heldCount()).toBe(m.held.size);
  for (const [id, p] of m.held) expect(r.rec.positionOf(id)).toEqual(p.pos);
  expect(r.clock.pending()).toBe(m.hold ? 1 : 0);
  const shown = r.holds.at(-1) ?? null;
  expect(shown?.pointerId ?? null).toBe(m.hold?.id ?? null);
}

type Kind = 'mouse' | 'touch' | 'pen';

const sampleOf = (m: Model, id: number, x: number, y: number, mods: EventModifiers, back: number): SampleIn => (
  { id, x, y, ...mods, stamp: model.stampFor(m, back) }
);
const wire = (s: SampleIn) => ({
  pointerId: s.id, clientX: s.x, clientY: s.y, altKey: s.altKey, ctrlKey: s.ctrlKey, metaKey: s.metaKey, shiftKey: s.shiftKey,
  ...(s.stamp !== undefined ? { timeStamp: s.stamp } : {}),
});

class Press implements fc.Command<Model, Real> {
  constructor(readonly id: number, readonly type: Kind, readonly x: number, readonly y: number, readonly mods: EventModifiers, readonly back: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const s = sampleOf(m, this.id, this.x, this.y, this.mods, this.back);
    const w = model.toWorld(s.x, s.y);
    step(m, r, model.press(m, s, this.type), () => { r.rec.press({ ...wire(s), x: w.x, y: w.y, pointerType: this.type }); });
  }
  toString = (): string => `press(${this.id}, ${this.type}, ${this.x}, ${this.y}, back ${this.back})`;
}

class Move implements fc.Command<Model, Real> {
  constructor(readonly id: number, readonly dx: number, readonly dy: number, readonly mods: EventModifiers, readonly back: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const from = m.held.get(this.id)?.pos ?? { x: 0, y: 0 };
    const s = sampleOf(m, this.id, from.x + this.dx, from.y + this.dy, this.mods, this.back);
    step(m, r, model.move(m, s), () => { r.rec.move(wire(s)); });
  }
  toString = (): string => `move(${this.id}, ${this.dx}, ${this.dy})`;
}

class Release implements fc.Command<Model, Real> {
  constructor(readonly id: number, readonly mods: EventModifiers, readonly back: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const pos = m.held.get(this.id)?.pos ?? { x: 7, y: 7 };
    const s = sampleOf(m, this.id, pos.x, pos.y, this.mods, this.back);
    const want = model.release(m, s);
    let outcome: ReturnType<PointerRecognizer['release']> = {};
    step(m, r, want.events, () => { outcome = r.rec.release(wire(s)); });
    expect(outcome).toEqual(want.doubleClick ? { doubleClick: want.doubleClick } : {});
  }
  toString = (): string => `release(${this.id}, back ${this.back})`;
}

/** A press released where it landed: the quickest way to a double click. */
class Tap implements fc.Command<Model, Real> {
  constructor(readonly press: Press, readonly release: Release) {}
  check = (m: Readonly<Model>): boolean => this.press.check(m);
  run(m: Model, r: Real): void {
    this.press.run(m, r);
    this.release.run(m, r);
  }
  toString = (): string => `tap(${this.press.toString()})`;
}

class Cancel implements fc.Command<Model, Real> {
  constructor(readonly id: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void { step(m, r, model.cancel(m, this.id), () => { r.rec.cancel(this.id); }); }
  toString = (): string => `cancel(${this.id})`;
}

class Advance implements fc.Command<Model, Real> {
  constructor(readonly ms: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void { step(m, r, model.advance(m, this.ms), () => { r.clock.advance(this.ms); }); }
  toString = (): string => `advance(${this.ms})`;
}

class TakeHold implements fc.Command<Model, Real> {
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const want = model.takeHold(m);
    let holding = false;
    step(m, r, want.events, () => { holding = r.rec.takeHold(); });
    expect(holding).toBe(want.holding);
  }
  toString = (): string => 'takeHold';
}

class Reset implements fc.Command<Model, Real> {
  check = (): boolean => true;
  run(m: Model, r: Real): void { model.reset(m); step(m, r, [], () => { r.rec.reset(); }); }
  toString = (): string => 'reset';
}

const id = fc.integer({ min: 1, max: 3 });
// Half the presses land on one spot, so second clicks often land near the first.
const coord = fc.oneof(fc.constant(0), fc.integer({ min: -12, max: 12 }));
const delta = fc.integer({ min: -6, max: 6 });
const back = fc.integer({ min: 0, max: 40 });

const commands = fc.commands([
  fc.tuple(id, fc.constantFrom<Kind>('mouse', 'touch', 'touch', 'pen'), coord, coord, modifiers, back)
    .map(([i, t, x, y, mods, b]) => new Press(i, t, x, y, mods, b)),
  fc.tuple(id, delta, delta, modifiers, back).map(([i, dx, dy, mods, b]) => new Move(i, dx, dy, mods, b)),
  fc.tuple(id, delta, delta, modifiers, back).map(([i, dx, dy, mods, b]) => new Move(i, dx, dy, mods, b)),
  fc.tuple(id, modifiers, back).map(([i, mods, b]) => new Release(i, mods, b)),
  fc.tuple(id, fc.constantFrom<Kind>('mouse', 'touch', 'pen'), coord, coord, modifiers, back, modifiers)
    .map(([i, t, x, y, mods, b, up]) => new Tap(new Press(i, t, x, y, mods, b), new Release(i, up, b))),
  id.map((i) => new Cancel(i)),
  fc.oneof(fc.integer({ min: 0, max: 80 }), fc.integer({ min: 100, max: 700 })).map((ms) => new Advance(ms)),
  fc.constant(new TakeHold()),
  fc.constant(new Reset()),
], { maxCommands: 60, size: 'max' });

const config: fc.Arbitrary<Config> = fc.record({
  dragPx: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
  longPressMs: fc.option(fc.integer({ min: 50, max: 600 }), { nil: undefined }),
  doubleClickMs: fc.option(fc.integer({ min: 0, max: 700 }), { nil: undefined }),
  doubleClickPx: fc.option(fc.integer({ min: 0, max: 12 }), { nil: undefined }),
  tapPx: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
  handles: fc.subarray(['longpress', 'contextmenu', 'doubleclick', 'click']),
  inFlight: fc.subarray([2, 3]),
  stamped: fc.boolean(),
});

describe('the pointer recognizer against a model', () => {
  it('dispatches exactly the events the model predicts, step by step', () => {
    fc.assert(fc.property(config, commands, (cfg, cmds) => {
      fc.modelRun(() => ({ model: model.freshModel(cfg), real: makeReal(cfg) }), cmds);
    }), runs(RUNS));
    for (const kind of [
      'press', 'drag', 'click', 'doubleclick', 'longpress', 'contextmenu', 'pointercancel',
      'multitouch:geometry', 'multitouch:commit', 'multitouch:cancel', 'multitouchtap',
    ]) expect(tally.get(kind) ?? 0, `${kind} in ${JSON.stringify([...tally])}`).toBeGreaterThan(0);
  }, timeoutFor(RUNS, 10));
});

type Op =
  | { op: 'press'; id: number; type: Kind; x: number; y: number }
  | { op: 'move' | 'release'; id: number; x: number; y: number }
  | { op: 'cancel'; id: number }
  | { op: 'advance'; ms: number };

const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ op: fc.constant('press' as const), id, type: fc.constantFrom<Kind>('mouse', 'touch', 'pen'), x: coord, y: coord }),
  fc.record({ op: fc.constantFrom('move' as const, 'release' as const), id, x: coord, y: coord }),
  fc.record({ op: fc.constant('cancel' as const), id }),
  fc.record({ op: fc.constant('advance' as const), ms: fc.integer({ min: 0, max: 700 }) }),
);

/** Every event `ops` dispatches with every point moved by `(dx, dy)`, moved back. */
function replay(ops: readonly Op[], cfg: Config, dx: number, dy: number): InputEvent[] {
  const r = makeReal(cfg);
  const at = (o: { id: number; x: number; y: number }) => ({ pointerId: o.id, clientX: o.x + dx, clientY: o.y + dy, ...NO_MODS });
  for (const o of ops) {
    if (o.op === 'press') r.rec.press({ ...at(o), ...model.toWorld(o.x + dx, o.y + dy), pointerType: o.type });
    else if (o.op === 'move') r.rec.move(at(o));
    else if (o.op === 'release') r.rec.release(at(o));
    else if (o.op === 'cancel') r.rec.cancel(o.id);
    else if (o.op === 'advance') r.clock.advance(o.ms);
  }
  const back = (v: number | undefined, d: number) => (v === undefined ? v : Math.round((v - d) * 1e6) / 1e6);
  return r.events.map((e) => JSON.parse(JSON.stringify(e, (k, v: unknown) => {
    if (typeof v !== 'number') return v;
    if (['x', 'clientX', 'pressX'].includes(k)) return back(v, dx);
    if (['y', 'clientY', 'pressY'].includes(k)) return back(v, dy);
    return v;
  })) as InputEvent);
}

describe('the pointer recognizer under a translation', () => {
  // Any sequence at all: presses of held pointers and releases far from the last move included.
  it('dispatches the same events, every point moved by the same amount', () => {
    const shift = fc.integer({ min: -500, max: 500 });
    let clicked = 0;
    fc.assert(fc.property(config, fc.array(op, { maxLength: 40 }), shift, shift, (cfg, ops, dx, dy) => {
      const plain = replay(ops, cfg, 0, 0);
      expect(plain.flatMap((e) => nonFinite(e))).toEqual([]);
      expect(replay(ops, cfg, dx, dy)).toEqual(plain);
      if (plain.some((e) => e.kind === 'click')) clicked++;
    }), runs(RUNS));
    expect(clicked).toBeGreaterThan(0);
  }, timeoutFor(RUNS, 10));
});
