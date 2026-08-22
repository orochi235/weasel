import { describe, expect, it, vi } from 'vitest';
import type { Scheduler } from './scheduler';
import { createAudioEngine } from './createAudioEngine';
import { createFakeAudioContext } from './testing/fakeAudioContext';

const { schedulers } = vi.hoisted(() => ({ schedulers: [] as Scheduler[] }));

// Transparent wrapper: the engine gets the real scheduler, the test gets a
// handle on it. Nothing else reaches the queue from outside the engine.
vi.mock('./scheduler', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./scheduler')>();
  return {
    ...mod,
    createScheduler: (opts: Parameters<typeof mod.createScheduler>[0]): Scheduler => {
      const s = mod.createScheduler(opts);
      schedulers.push(s);
      return s;
    },
  };
});

function harness() {
  const ctx = createFakeAudioContext();
  const engine = createAudioEngine({
    context: ctx as never,
    setTimer: () => 1,
    clearTimer: () => {},
    fetchFn: (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as never,
  });
  return { ctx, engine, queue: schedulers[schedulers.length - 1] };
}

describe('createAudioEngine queue hygiene', () => {
  it('takes a stopped key out of the queue rather than leaving it to fire', async () => {
    const { engine, queue } = harness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { when: 10_000, cancelKey: 'late' });
    expect(queue.pending()).toBe(1);
    engine.stopKey('late');
    expect(queue.pending()).toBe(0);
  });

  it('empties the queue on dispose', async () => {
    const { engine, queue } = harness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { when: 10_000 });
    expect(queue.pending()).toBe(1);
    engine.dispose();
    expect(queue.pending()).toBe(0);
  });
});
