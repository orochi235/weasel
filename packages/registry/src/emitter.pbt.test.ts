/**
 * Stateful property test of `createEmitter`: random subscribes, unsubscribes (fresh and stale), and emits whose
 * listeners subscribe, unsubscribe, throw, or emit again mid-pass, against a model of the subscriptions held.
 * Every emit checks the exact calls made, in order, and every step the size.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { createEmitter, type Emitter } from './emitter';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;
const LISTENERS = 4;

/** What a listener does when called during an emit. */
type Act =
  | { kind: 'none' }
  | { kind: 'throw' }
  | { kind: 'sub'; who: number }
  | { kind: 'unsub'; handle: number }
  | { kind: 'emit' };

interface Model {
  /** Held subscriptions in order: the listener and the subscription that holds it. */
  held: { who: number; gen: number }[];
  gen: number;
  /** Each unsubscribe handed out: whose, and which subscription it releases. */
  handles: { who: number; gen: number }[];
}

interface Real {
  e: Emitter<[number]>;
  fns: ((n: number) => void)[];
  offs: (() => void)[];
  calls: string[];
  acts: readonly Act[];
  depth: number;
}

const t = tally();

function subscribeModel(m: Model, who: number): void {
  const at = m.held.find((h) => h.who === who);
  if (at) m.handles.push({ ...at });
  else {
    const h = { who, gen: ++m.gen };
    m.held.push(h);
    m.handles.push({ ...h });
  }
}

function unsubscribeModel(m: Model, handle: number): void {
  const h = m.handles[handle];
  if (!h) return;
  const i = m.held.findIndex((x) => x.who === h.who && x.gen === h.gen);
  if (i >= 0) m.held.splice(i, 1);
}

/** The calls an emit of `n` makes under `acts`, applying each listener's act to the model as it goes. */
function emitModel(m: Model, n: number, acts: readonly Act[], depth: number, calls: string[]): void {
  for (const s of [...m.held]) {
    if (!m.held.some((h) => h.who === s.who && h.gen === s.gen)) continue;
    calls.push(`${s.who}:${n}@${depth}`);
    const act = acts[s.who]!;
    if (act.kind === 'sub') subscribeModel(m, act.who);
    else if (act.kind === 'unsub') unsubscribeModel(m, act.handle % Math.max(1, m.handles.length));
    else if (act.kind === 'emit' && depth === 0) emitModel(m, n + 100, acts, 1, calls);
  }
}

function makeReal(): Real {
  const r: Real = { e: createEmitter<[number]>(), fns: [], offs: [], calls: [], acts: [], depth: 0 };
  for (let who = 0; who < LISTENERS; who++) {
    r.fns.push((n) => {
      r.calls.push(`${who}:${n}@${r.depth}`);
      const act = r.acts[who]!;
      if (act.kind === 'throw') throw new Error(`listener ${who}`);
      if (act.kind === 'sub') r.offs.push(r.e.subscribe(r.fns[act.who]!));
      else if (act.kind === 'unsub') r.offs[act.handle % Math.max(1, r.offs.length)]?.();
      else if (act.kind === 'emit' && r.depth === 0) {
        r.depth = 1;
        r.e.emit(n + 100);
        r.depth = 0;
      }
    });
  }
  return r;
}

const check = (m: Model, r: Real) => { expect(r.e.size).toBe(m.held.length); };

class Subscribe implements fc.Command<Model, Real> {
  constructor(readonly who: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    subscribeModel(m, this.who);
    r.offs.push(r.e.subscribe(r.fns[this.who]!));
    check(m, r);
  }
  toString = (): string => `sub(${this.who})`;
}

class Unsubscribe implements fc.Command<Model, Real> {
  constructor(readonly handle: number) {}
  check = (m: Readonly<Model>): boolean => m.handles.length > 0;
  run(m: Model, r: Real): void {
    const i = this.handle % m.handles.length;
    const h = m.handles[i]!;
    t.count(m.held.some((x) => x.who === h.who && x.gen === h.gen) ? 'live unsub' : 'stale unsub');
    unsubscribeModel(m, i);
    r.offs[i]!();
    check(m, r);
  }
  toString = (): string => `unsub(#${this.handle})`;
}

class Emit implements fc.Command<Model, Real> {
  constructor(readonly n: number, readonly acts: readonly Act[]) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const want: string[] = [];
    const before = m.handles.length;
    emitModel(m, this.n, this.acts, 0, want);
    r.acts = this.acts;
    r.calls = [];
    r.e.emit(this.n);
    expect(r.calls).toEqual(want);
    expect(r.offs.length).toBe(m.handles.length);
    if (want.length > 0) t.count('emit heard');
    if (m.handles.length > before) t.count('sub mid-pass');
    if (want.some((c) => c.endsWith('@1'))) t.count('nested emit');
    check(m, r);
  }
  toString = (): string => `emit(${this.n}, ${JSON.stringify(this.acts)})`;
}

const who = fc.integer({ min: 0, max: LISTENERS - 1 });
const act: fc.Arbitrary<Act> = fc.oneof(
  { weight: 4, arbitrary: fc.constant({ kind: 'none' as const }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'throw' as const }) },
  { weight: 2, arbitrary: who.map((w) => ({ kind: 'sub' as const, who: w })) },
  { weight: 2, arbitrary: fc.nat(20).map((h) => ({ kind: 'unsub' as const, handle: h })) },
  { weight: 2, arbitrary: fc.constant({ kind: 'emit' as const }) },
);

const commands = [
  who.map((w) => new Subscribe(w)),
  who.map((w) => new Subscribe(w)),
  fc.nat(20).map((h) => new Unsubscribe(h)),
  fc.tuple(fc.integer({ min: 0, max: 99 }), fc.array(act, { minLength: LISTENERS, maxLength: LISTENERS })).map(([n, acts]) => new Emit(n, acts)),
];

describe('createEmitter, against a model', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('calls each held listener once per emit, in order, whatever listeners do mid-pass', () => {
    fc.assert(fc.property(fc.commands(commands, { maxCommands: 30 }), (cmds) => {
      fc.modelRun(() => ({ model: { held: [], gen: 0, handles: [] }, real: makeReal() }), cmds);
    }), runs(RUNS));
    t.atLeast('emit heard', RUNS / 4);
    t.atLeast('live unsub', RUNS / 8);
    t.atLeast('stale unsub', RUNS / 12);
    t.atLeast('sub mid-pass', RUNS / 15);
    t.atLeast('nested emit', RUNS / 15);
  }, timeoutFor(RUNS, 5));
});

describe('createEmitter, shrunk', () => {
  it('skips a listener unsubscribed and subscribed again before its turn in a pass', () => {
    const e = createEmitter();
    const seen: string[] = [];
    const b = () => { seen.push('b'); };
    let once = true;
    e.subscribe(() => { seen.push('a'); if (once) { once = false; offB(); e.subscribe(b); } });
    const offB = e.subscribe(b);
    e.emit();
    expect(seen).toEqual(['a']);
    seen.length = 0;
    e.emit();
    expect(seen).toEqual(['a', 'b']);
  });

  it('leaves a later subscription alone when an earlier unsubscribe is called again', () => {
    const e = createEmitter();
    const fn = vi.fn();
    const off = e.subscribe(fn);
    off();
    e.subscribe(fn);
    off();
    e.emit();
    expect(fn).toHaveBeenCalledOnce();
  });
});
