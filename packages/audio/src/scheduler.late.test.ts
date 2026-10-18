import { describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createScheduler } from './scheduler';
import { createFakeAudioContext } from './testing/fakeAudioContext';

function harness() {
  let nowMs = 0;
  let pass: (() => void) | null = null;
  const onLate = vi.fn();
  const scheduler = createScheduler({
    now: () => nowMs,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
    lookahead: 100,
    interval: 25,
    onLate,
  });
  scheduler.start();
  return { scheduler, onLate, tickAt: (t: number) => { nowMs = t; pass?.(); } };
}

describe('createScheduler onLate', () => {
  it('reports an event its pass reached only after its time, and still fires it', () => {
    const { scheduler, onLate, tickAt } = harness();
    const fire = vi.fn();
    scheduler.schedule(500, fire);
    tickAt(300);
    expect(fire).not.toHaveBeenCalled();
    // The passes between stalled: the next one arrives 120 ms past the event.
    tickAt(620);
    expect(fire).toHaveBeenCalledWith(500);
    expect(onLate.mock.calls).toEqual([[120, 500]]);
  });

  it('says nothing of a late event booked with reportLate: false, and still fires it', () => {
    const { scheduler, onLate, tickAt } = harness();
    const fire = vi.fn();
    scheduler.schedule(500, fire, undefined, { reportLate: false });
    tickAt(620);
    expect(fire).toHaveBeenCalledWith(500);
    expect(onLate).not.toHaveBeenCalled();
  });

  it('says nothing of an event a pass reached inside the lookahead', () => {
    const { scheduler, onLate, tickAt } = harness();
    scheduler.schedule(500, () => {});
    tickAt(425);
    expect(onLate).not.toHaveBeenCalled();
  });

  it('says nothing of an event booked for a time already past', async () => {
    const { scheduler, onLate, tickAt } = harness();
    tickAt(300);
    const fire = vi.fn();
    scheduler.schedule(250, fire);
    await Promise.resolve();
    expect(fire).toHaveBeenCalled();
    expect(onLate).not.toHaveBeenCalled();
  });
});

describe('createAudioEngine onLate', () => {
  it('reports a voice that started late, in ms on the audio clock', async () => {
    const ctx = createFakeAudioContext();
    let pass: (() => void) | null = null;
    const onLate = vi.fn();
    const engine = createAudioEngine({
      context: ctx as never,
      setTimer: (cb) => { pass = cb; return 1; },
      clearTimer: () => { pass = null; },
      onLate,
    });
    await engine.unlock();
    engine.playNote({ pitch: 220, when: 500, duration: 50 });
    const tick = (): void => pass?.();
    ctx._advance(650);
    tick();
    expect(ctx._oscillators).toHaveLength(1);
    expect(onLate.mock.calls).toEqual([[150, 500]]);
  });
});
