import { describe, expect, it, vi } from 'vitest';
import { engineHarness } from './engineHarness';
import { createFakeMediaElement } from './fakeAudioContext';

describe('engineHarness', () => {
  it('keeps the scheduler running beside another engine timer', async () => {
    const { engine, run } = await engineHarness();
    const fire = vi.fn();
    engine.schedule(1000, fire);
    const voice = engine.stream(createFakeMediaElement() as never);
    await run(100);
    // A fading stop waits on a timer of its own beside the scheduler's pass.
    voice.stop(300);
    await run(1100);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('keeps the scheduler running when another engine timer is cancelled', async () => {
    const { engine, run } = await engineHarness();
    const fire = vi.fn();
    engine.schedule(1000, fire);
    const voice = engine.stream(createFakeMediaElement() as never);
    await run(100);
    voice.stop(300);
    await run(50);
    voice.stop(0);
    await run(1100);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('advances the clock by exactly the time asked for', async () => {
    const { ctx, run } = await engineHarness();
    await run(30);
    expect(ctx.currentTime).toBeCloseTo(0.03, 9);
  });
});
