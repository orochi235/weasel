/**
 * Stateful test of the lookahead scheduler: bookings before, inside, and past the lookahead, cancels by key,
 * clears, starts and stops, and clock advances of any length with the armed pass run late, each command's
 * microtasks flushed after it,
 * with callbacks that cancel a key or book another event. Checked against a model of the queue after every
 * step: each batch fires exactly the events due, in time order, none before its lookahead window opens; `onLate`
 * names exactly the late ones; and once the clock passes everything, each event not canceled has fired once.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createScheduler, type Scheduler } from './scheduler';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;
const LOOKAHEAD = 100;
const KEYS = ['a', 'b', 'c'] as const;

type Child = { kind: 'none' } | { kind: 'cancel'; key: string } | { kind: 'book'; offset: number; key?: string };
interface Entry { id: number; when: number; key?: string; waited: boolean; child: Child }

interface Model {
  now: number;
  running: boolean;
  flushQueued: boolean;
  queue: Entry[];
  booked: Map<number, Entry>;
  dropped: Set<number>;
  nextId: number;
}
interface Real {
  scheduler: Scheduler;
  clock: { now: number };
  armed: (() => void) | null;
  fired: { id: number; when: number; at: number }[];
  late: { lateMs: number; when: number }[];
}

const seen = tally();

/** Drop every queued event with `key` from the model, as `cancelKey` does. */
function dropKey(m: Model, key: string): void {
  for (const q of m.queue) if (q.key === key) m.dropped.add(q.id);
  m.queue = m.queue.filter((q) => q.key !== key);
}

/** Book an event on both sides: the model's queue and the real scheduler. Its callback acts on both too. */
function book(m: Model, r: Real, offset: number, key: string | undefined, reportLate: boolean, child: Child): void {
  const id = m.nextId++;
  const when = m.now + offset;
  const waited = when > m.now + LOOKAHEAD;
  const entry: Entry = { id, when, ...(key !== undefined ? { key } : {}), waited: waited && reportLate, child };
  m.queue.push(entry);
  m.booked.set(id, entry);
  if (m.running && !m.flushQueued && !waited) m.flushQueued = true;
  r.scheduler.schedule(when, (w) => {
    r.fired.push({ id, when: w, at: r.clock.now });
    if (child.kind === 'cancel') {
      r.scheduler.cancelKey(child.key);
      dropKey(m, child.key);
    } else if (child.kind === 'book') {
      book(m, r, child.offset, child.key, true, { kind: 'none' });
    }
  }, key, reportLate ? undefined : { reportLate: false });
}

/** What the model has due now when `batch` is set, taken out of its queue; the check returned holds the real
 *  scheduler to having fired exactly that since. Taken before the firing, so a callback's own effects land after. */
function expectBatch(m: Model, r: Real, batch: boolean): () => void {
  const fromFired = r.fired.length;
  const fromLate = r.late.length;
  let due: Entry[] = [];
  if (batch) {
    const horizon = m.now + LOOKAHEAD;
    due = m.queue.filter((e) => e.when <= horizon).sort((a, b) => a.when - b.when);
    m.queue = m.queue.filter((e) => e.when > horizon);
  }
  const expectedLate = due.filter((e) => e.waited && e.when < m.now).map((e) => ({ lateMs: m.now - e.when, when: e.when }));
  return () => {
    const got = r.fired.slice(fromFired);
    expect(got.map((f) => f.id)).toEqual(due.map((e) => e.id));
    for (const f of got) {
      expect(f.when).toBe(m.booked.get(f.id)!.when);
      expect(f.at).toBeGreaterThanOrEqual(f.when - LOOKAHEAD);
    }
    for (let i = 1; i < got.length; i += 1) expect(got[i]!.when).toBeGreaterThanOrEqual(got[i - 1]!.when);
    expect(r.late.slice(fromLate)).toEqual(expectedLate);
    if (got.length > 1) seen.count('batch');
    if (expectedLate.length > 0) seen.count('late');
  };
}

/** Let the microtasks a command queued run, as they would at the end of its task: a flush fires what is due
 *  when the scheduler is running, and may book more. Then the queue lengths agree. */
async function finish(m: Model, r: Real): Promise<void> {
  while (m.flushQueued) {
    const batch = m.running;
    m.flushQueued = false;
    const verify = expectBatch(m, r, batch);
    // One tick: the queued flush runs, and any flush it queues waits behind this continuation.
    await Promise.resolve();
    verify();
  }
  expect(r.scheduler.pending()).toBe(m.queue.length);
}

class Start implements fc.AsyncCommand<Model, Real> {
  check = () => true;
  async run(m: Model, r: Real): Promise<void> {
    r.scheduler.start();
    m.running = true;
    expect(r.armed).not.toBeNull();
    await finish(m, r);
  }
  toString = () => 'start';
}

class Stop implements fc.AsyncCommand<Model, Real> {
  check = () => true;
  async run(m: Model, r: Real): Promise<void> {
    r.scheduler.stop();
    m.running = false;
    expect(r.armed).toBeNull();
    await finish(m, r);
  }
  toString = () => 'stop';
}

class Book implements fc.AsyncCommand<Model, Real> {
  constructor(readonly offset: number, readonly key: string | undefined, readonly reportLate: boolean, readonly child: Child) {}
  check = () => true;
  async run(m: Model, r: Real): Promise<void> {
    book(m, r, this.offset, this.key, this.reportLate, this.child);
    await finish(m, r);
  }
  toString = () => `book(+${this.offset}, ${this.key}, ${this.reportLate}, ${JSON.stringify(this.child)})`;
}

class CancelKey implements fc.AsyncCommand<Model, Real> {
  constructor(readonly key: string) {}
  check = () => true;
  async run(m: Model, r: Real): Promise<void> {
    r.scheduler.cancelKey(this.key);
    dropKey(m, this.key);
    await finish(m, r);
  }
  toString = () => `cancelKey(${this.key})`;
}

class Clear implements fc.AsyncCommand<Model, Real> {
  check = () => true;
  async run(m: Model, r: Real): Promise<void> {
    r.scheduler.clear();
    for (const q of m.queue) m.dropped.add(q.id);
    m.queue = [];
    await finish(m, r);
  }
  toString = () => 'clear';
}

/** The clock moves on, and the armed pass runs then, however late. */
class Advance implements fc.AsyncCommand<Model, Real> {
  constructor(readonly ms: number) {}
  check = () => true;
  async run(m: Model, r: Real): Promise<void> {
    m.now += this.ms;
    r.clock.now = m.now;
    const pass = r.armed;
    const verify = expectBatch(m, r, pass !== null);
    r.armed = null;
    pass?.();
    verify();
    expect(r.armed !== null).toBe(m.running);
    await finish(m, r);
  }
  toString = () => `advance(${this.ms})`;
}

const offset = fc.oneof(fc.integer({ min: -200, max: 400 }), fc.constantFrom(0, LOOKAHEAD, LOOKAHEAD + 1));
const key = fc.option(fc.constantFrom(...KEYS), { nil: undefined });
const child: fc.Arbitrary<Child> = fc.oneof(
  { weight: 4, arbitrary: fc.constant({ kind: 'none' as const }) },
  { weight: 1, arbitrary: fc.constantFrom(...KEYS).map((k) => ({ kind: 'cancel' as const, key: k })) },
  { weight: 1, arbitrary: fc.tuple(offset, key).map(([o, k]) => ({ kind: 'book' as const, offset: o, ...(k !== undefined ? { key: k } : {}) })) },
);
const commands = fc.commands([
  fc.constant(new Start()),
  fc.constant(new Stop()),
  ...[1, 2, 3].map(() => fc.tuple(offset, key, fc.boolean(), child).map(([o, k, l, c]) => new Book(o, k, l, c))),
  fc.constantFrom(...KEYS).map((k) => new CancelKey(k)),
  fc.constant(new Clear()),
  fc.oneof(fc.integer({ min: 0, max: 60 }), fc.integer({ min: 0, max: 1000 })).map((ms) => new Advance(ms)),
], { maxCommands: 50, size: '+1' });

describe('createScheduler', () => {
  it('fires each event once, due and in order, none early and none lost, as its model does', async () => {
    await fc.assert(fc.asyncProperty(commands, async (cmds) => {
      const model: Model = { now: 0, running: false, flushQueued: false, queue: [], booked: new Map(), dropped: new Set(), nextId: 0 };
      const real: Real = { scheduler: null as never, clock: { now: 0 }, armed: null, fired: [], late: [] };
      real.scheduler = createScheduler({
        now: () => real.clock.now,
        setTimer: (cb) => { real.armed = cb; return cb; },
        clearTimer: (h) => { if (real.armed === h) real.armed = null; },
        lookahead: LOOKAHEAD,
        interval: 25,
        onLate: (lateMs, when) => { real.late.push({ lateMs, when }); },
      });
      await fc.asyncModelRun(() => ({ model, real }), cmds);
      // Run the clock past everything booked: what was not dropped fires, once.
      await new Start().run(model, real);
      for (let i = 0; i < 4; i += 1) await new Advance(1000).run(model, real);
      expect(real.scheduler.pending()).toBe(0);
      const counts = new Map<number, number>();
      for (const f of real.fired) counts.set(f.id, (counts.get(f.id) ?? 0) + 1);
      for (const id of model.booked.keys()) {
        expect(counts.get(id) ?? 0, `event ${id}`).toBe(model.dropped.has(id) ? 0 : 1);
      }
      if (model.dropped.size > 0) seen.count('dropped');
      if (model.booked.size > 4) seen.count('busy');
    }), runs(RUNS));
    seen.atLeast('batch', RUNS / 4);
    seen.atLeast('late', RUNS / 10);
    seen.atLeast('dropped', RUNS / 4);
    seen.atLeast('busy', RUNS / 4);
  }, timeoutFor(RUNS, 20));
});
