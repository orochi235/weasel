/**
 * Stateful test of the tick timer over a fake worker: timers set and cleared, the worker's replies (late, repeated,
 * or for a timer already cleared), a worker that fails and hands its timers to `setTimeout`, the clock, and
 * dispose. Against a model of the pending timers: each callback runs once at most, never after its clear or the
 * dispose, and a timer the failure handed over fires its whole delay after it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { createTickTimer, type TickTimer } from './tickTimer';
import { stubWorkerGlobals, type FakeWorker } from './testing/fakeWorker';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;

interface Pending { ms: number; dueAt: number | null }
interface Model {
  now: number;
  worker: boolean;
  disposed: boolean;
  pending: Map<number, Pending>;
  ids: number[];
  /** Ids the worker was told to time, and not told to clear since. */
  timing: Set<number>;
}
interface Real {
  timer: TickTimer;
  worker: FakeWorker;
  fired: number[];
  handles: number[];
  posts: number;
}

const seen = tally();

/** What the fake worker was sent since the last look, applied to the timers it holds. */
function readPosts(m: Model, r: Real): void {
  for (const msg of r.worker.posted.slice(r.posts) as { id: number; ms?: number }[]) {
    if (msg.ms === undefined) m.timing.delete(msg.id);
    else m.timing.add(msg.id);
  }
  r.posts = r.worker.posted.length;
}

function check(m: Model, r: Real): void {
  readPosts(m, r);
  const fallback = [...m.pending.values()].filter((p) => p.dueAt !== null).length;
  expect(vi.getTimerCount()).toBe(fallback);
  if (m.worker) for (const index of m.pending.keys()) expect(m.timing.has(r.handles[index]!)).toBe(true);
}

class SetTimer implements fc.Command<Model, Real> {
  constructor(readonly ms: number) {}
  check = (m: Readonly<Model>) => !m.disposed;
  run(m: Model, r: Real): void {
    const index = r.handles.length;
    const handle = r.timer.setTimer(() => { r.fired.push(index); }, this.ms) as number;
    r.handles.push(handle);
    m.ids.push(index);
    m.pending.set(index, { ms: this.ms, dueAt: m.worker ? null : m.now + this.ms });
    check(m, r);
  }
  toString = () => `setTimer(${this.ms})`;
}

class ClearTimer implements fc.Command<Model, Real> {
  constructor(readonly pick: number) {}
  check = (m: Readonly<Model>) => m.ids.length > 0;
  run(m: Model, r: Real): void {
    const index = m.ids[this.pick % m.ids.length]!;
    r.timer.clearTimer(r.handles[index]);
    m.pending.delete(index);
    check(m, r);
  }
  toString = () => `clearTimer(#${this.pick})`;
}

/** The worker posts back a timer's id, as its own timeout would: maybe after a clear, maybe twice. */
class Reply implements fc.Command<Model, Real> {
  constructor(readonly pick: number, readonly live: boolean) {}
  check = (m: Readonly<Model>) => m.ids.length > 0;
  run(m: Model, r: Real): void {
    const from = this.live && m.pending.size > 0 ? [...m.pending.keys()] : m.ids;
    const index = from[this.pick % from.length]!;
    const before = r.fired.length;
    r.worker._reply(r.handles[index]);
    const fires = m.worker && m.pending.get(index)?.dueAt === null;
    if (fires) m.pending.delete(index);
    expect(r.fired.slice(before)).toEqual(fires ? [index] : []);
    seen.count(fires ? 'replied' : 'stale reply');
    check(m, r);
  }
  toString = () => `reply(#${this.pick}${this.live ? ', live' : ''})`;
}

class Fail implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void {
    r.worker._fail();
    if (m.worker && !m.disposed) {
      for (const p of m.pending.values()) p.dueAt = m.now + p.ms;
      m.worker = false;
      seen.count('failed over');
    }
    check(m, r);
  }
  toString = () => 'fail';
}

class Advance implements fc.Command<Model, Real> {
  constructor(readonly ms: number) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const before = r.fired.length;
    m.now += this.ms;
    vi.advanceTimersByTime(this.ms);
    const due = [...m.pending].filter(([, p]) => p.dueAt !== null && p.dueAt <= m.now);
    due.sort(([a, p], [b, q]) => p.dueAt! - q.dueAt! || a - b);
    for (const [index] of due) m.pending.delete(index);
    expect(r.fired.slice(before)).toEqual(due.map(([index]) => index));
    if (due.length > 0) seen.count('fell back');
    check(m, r);
  }
  toString = () => `advance(${this.ms})`;
}

class Dispose implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void {
    r.timer.dispose();
    m.pending.clear();
    m.disposed = true;
    m.worker = false;
    expect(r.worker.terminated).toBe(true);
    check(m, r);
  }
  toString = () => 'dispose';
}

const delay = fc.oneof(fc.integer({ min: 0, max: 50 }), fc.constantFrom(25, 1000));
const commands = fc.commands([
  ...[1, 2, 3].map(() => delay.map((ms) => new SetTimer(ms))),
  fc.nat().map((p) => new ClearTimer(p)),
  ...[1, 2, 3].map(() => fc.tuple(fc.nat(), fc.boolean()).map(([p, live]) => new Reply(p, live))),
  fc.constant(new Fail()),
  ...[1, 2].map(() => fc.integer({ min: 0, max: 60 }).map((ms) => new Advance(ms))),
  fc.constant(new Dispose()),
], { maxCommands: 40, size: '+1' });

describe('createTickTimer', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('runs each callback once at most, never after its clear or the dispose, through a worker failure', () => {
    fc.assert(fc.property(commands, (cmds) => {
      vi.useFakeTimers();
      const env = stubWorkerGlobals();
      try {
        const timer = createTickTimer();
        const real: Real = { timer, worker: env.workers[0]!, fired: [], handles: [], posts: 0 };
        const model: Model = { now: 0, worker: true, disposed: false, pending: new Map(), ids: [], timing: new Set() };
        fc.modelRun(() => ({ model, real }), cmds);
        // Nothing still pending may fire after a dispose.
        const before = real.fired.length;
        real.timer.dispose();
        vi.advanceTimersByTime(10_000);
        expect(real.fired.length).toBe(before);
        expect(new Set(real.fired).size).toBe(real.fired.length);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        env.restore();
        vi.useRealTimers();
      }
    }), runs(RUNS));
    for (const what of ['replied', 'stale reply', 'failed over', 'fell back']) seen.atLeast(what, RUNS / 20);
  }, timeoutFor(RUNS, 10));
});
