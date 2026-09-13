import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createFakeAudioContext } from './testing/fakeAudioContext';
import { stubWorkerGlobals } from './testing/fakeWorker';

/** The engine's own `setTimer`/`clearTimer` defaults. Every other engine test
 *  injects them, which is how a repeating default timer under a scheduler that
 *  re-arms itself reached the published package. */
describe('createAudioEngine shipped timer defaults', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('keeps one timer live however many passes run, and none after dispose', () => {
    vi.useFakeTimers();
    const ctx = createFakeAudioContext();
    const engine = createAudioEngine({ context: ctx as never });
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(25 * 8);
    expect(vi.getTimerCount()).toBe(1);
    engine.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('wakes its passes from a worker where one exists, and terminates it on dispose', async () => {
    const env = stubWorkerGlobals();
    try {
      const ctx = createFakeAudioContext();
      const engine = createAudioEngine({ context: ctx as never });
      expect(env.workers).toHaveLength(1);
      const worker = env.workers[0];
      await engine.unlock();
      engine.play(engine.register(ctx.createBuffer(1, 48000, 48000) as never));
      expect(ctx._sources).toHaveLength(0);

      worker._reply((worker.posted[0] as { id: number }).id);
      expect(ctx._sources).toHaveLength(1);
      expect(worker.posted[1]).toEqual({ id: expect.any(Number), ms: 25 });

      engine.dispose();
      expect(worker.terminated).toBe(true);
    } finally {
      env.restore();
    }
  });

  it('leaves the timer to a consumer that injects one', () => {
    const env = stubWorkerGlobals();
    try {
      createAudioEngine({
        context: createFakeAudioContext() as never,
        setTimer: () => 1,
        clearTimer: () => {},
      });
      expect(env.workers).toHaveLength(0);
    } finally {
      env.restore();
    }
  });
});
