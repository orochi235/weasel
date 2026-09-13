import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTickTimer } from './tickTimer';
import { stubWorkerGlobals } from './testing/fakeWorker';

// jsdom cannot throttle a timer, so nothing here shows a hidden tab being
// survived. These pin what wakes the callback and what teardown stops.

describe('createTickTimer without a Worker', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('falls back to setTimeout', () => {
    vi.useFakeTimers();
    const timer = createTickTimer();
    const cb = vi.fn();
    timer.setTimer(cb, 25);
    vi.advanceTimersByTime(24);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('clears a fallback timer', () => {
    vi.useFakeTimers();
    const timer = createTickTimer();
    const cb = vi.fn();
    timer.clearTimer(timer.setTimer(cb, 25));
    vi.advanceTimersByTime(100);
    expect(cb).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no timer live after dispose', () => {
    vi.useFakeTimers();
    const timer = createTickTimer();
    timer.setTimer(vi.fn(), 25);
    timer.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('createTickTimer with a Worker', () => {
  let env: ReturnType<typeof stubWorkerGlobals>;
  afterEach(() => { env.restore(); vi.useRealTimers(); });

  it('spawns one worker from a JavaScript blob', () => {
    env = stubWorkerGlobals();
    createTickTimer();
    expect(env.workers).toHaveLength(1);
    expect(env.workers[0].url).toBe('blob:fake/1');
    expect(env.scripts).toHaveLength(1);
  });

  it('books the delay in the worker, not on a main-thread timer', () => {
    env = stubWorkerGlobals();
    vi.useFakeTimers();
    const timer = createTickTimer();
    timer.setTimer(vi.fn(), 25);
    expect(env.workers[0].posted).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('runs the callback when the worker replies, once', () => {
    env = stubWorkerGlobals();
    const timer = createTickTimer();
    const cb = vi.fn();
    timer.setTimer(cb, 25);
    const worker = env.workers[0];
    const { id } = worker.posted[0] as { id: number; ms: number };
    expect(cb).not.toHaveBeenCalled();
    worker._reply(id);
    worker._reply(id);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('runs only the callback whose id came back', () => {
    env = stubWorkerGlobals();
    const timer = createTickTimer();
    const first = vi.fn();
    const second = vi.fn();
    timer.setTimer(first, 25);
    timer.setTimer(second, 50);
    const worker = env.workers[0];
    worker._reply((worker.posted[1] as { id: number }).id);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('ignores a reply that was already in flight when the timer was cleared', () => {
    env = stubWorkerGlobals();
    const timer = createTickTimer();
    const cb = vi.fn();
    const handle = timer.setTimer(cb, 25);
    const worker = env.workers[0];
    const { id } = worker.posted[0] as { id: number };
    timer.clearTimer(handle);
    worker._reply(id);
    expect(cb).not.toHaveBeenCalled();
  });

  it('tells the worker to drop a cleared timer', () => {
    env = stubWorkerGlobals();
    const timer = createTickTimer();
    const handle = timer.setTimer(vi.fn(), 25);
    timer.clearTimer(handle);
    const worker = env.workers[0];
    const { id } = worker.posted[0] as { id: number };
    expect(worker.posted[1]).toEqual({ id });
  });

  it('terminates the worker and revokes its URL on dispose', () => {
    env = stubWorkerGlobals();
    const timer = createTickTimer();
    const cb = vi.fn();
    timer.setTimer(cb, 25);
    const worker = env.workers[0];
    const { id } = worker.posted[0] as { id: number };
    timer.dispose();
    expect(worker.terminated).toBe(true);
    expect(env.revoked).toEqual([worker.url]);
    worker._reply(id);
    expect(cb).not.toHaveBeenCalled();
  });

  it('moves pending timers onto setTimeout when the worker fails to load', () => {
    env = stubWorkerGlobals();
    vi.useFakeTimers();
    const timer = createTickTimer();
    const cb = vi.fn();
    timer.setTimer(cb, 25);
    env.workers[0]._fail();
    expect(env.workers[0].terminated).toBe(true);
    vi.advanceTimersByTime(25);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('books later timers on setTimeout once the worker has failed', () => {
    env = stubWorkerGlobals();
    vi.useFakeTimers();
    const timer = createTickTimer();
    env.workers[0]._fail();
    const cb = vi.fn();
    timer.setTimer(cb, 25);
    expect(env.workers[0].posted).toHaveLength(0);
    vi.advanceTimersByTime(25);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('falls back to setTimeout when constructing the worker throws', () => {
    env = stubWorkerGlobals();
    vi.stubGlobal('Worker', function RefusedWorker() {
      throw new Error('SecurityError: refused by Content-Security-Policy');
    });
    vi.useFakeTimers();
    const timer = createTickTimer();
    const cb = vi.fn();
    timer.setTimer(cb, 25);
    vi.advanceTimersByTime(25);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(env.revoked).toEqual(['blob:fake/1']);
  });
});

describe('the tick worker script', () => {
  let env: ReturnType<typeof stubWorkerGlobals>;
  afterEach(() => { env.restore(); vi.useRealTimers(); });

  /** Evaluates the script the timer actually ships, in a stand-in worker scope
   *  whose timers are vitest's. */
  function bootScript() {
    env = stubWorkerGlobals();
    createTickTimer();
    const self = {
      onmessage: null as ((e: { data: unknown }) => void) | null,
      postMessage: vi.fn(),
    };
    vi.useFakeTimers();
    new Function('self', env.scripts[0])(self);
    return { send: (data: unknown) => self.onmessage?.({ data }), replies: self.postMessage };
  }

  it('posts a timer id back once its delay has passed', () => {
    const w = bootScript();
    w.send({ id: 7, ms: 25 });
    vi.advanceTimersByTime(24);
    expect(w.replies).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(w.replies).toHaveBeenCalledWith(7);
    expect(w.replies).toHaveBeenCalledTimes(1);
  });

  it('never posts a cleared timer', () => {
    const w = bootScript();
    w.send({ id: 7, ms: 25 });
    w.send({ id: 7 });
    vi.advanceTimersByTime(100);
    expect(w.replies).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
