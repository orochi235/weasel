import { describe, expect, it } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createFilterEffect } from './effects';
import { createFakeAudioContext } from './testing/fakeAudioContext';
import { allPaths } from './testing/graphWalk';

async function harness() {
  const ctx = createFakeAudioContext();
  const timers = new Map<number, () => void>();
  let id = 0;
  const engine = createAudioEngine({
    context: ctx as never,
    insertFadeMs: 10,
    setTimer: (cb: () => void) => { id += 1; timers.set(id, cb); return id; },
    clearTimer: (h: unknown) => { timers.delete(h as number); },
  });
  await engine.unlock();
  const tick = (): void => {
    const due = [...timers.values()];
    timers.clear();
    for (const f of due) f();
  };
  return { ctx, engine, timers, tick };
}

describe('engine bus inserts', () => {
  it('runs a voice through its bus’s insert on the way to the destination', async () => {
    const { ctx, engine, tick } = await harness();
    const fx = createFilterEffect(engine.context, { frequency: 800 });
    engine.bus('sfx').inserts.add(fx);
    const sound = engine.register(ctx.createBuffer(1, 48, 48000) as never);
    engine.play(sound, { bus: 'sfx', loop: true });
    ctx._advance(10);
    tick();
    const routes = allPaths(ctx._sources[0], ctx.destination);
    expect(routes.some((r) => r.includes(fx.filter as never))).toBe(true);
    // Only the bypass route skips it, once the splice has landed.
    expect(routes.filter((r) => !r.includes(fx.filter as never))).toHaveLength(1);
  });

  it('leaves another bus’s voices out of it', async () => {
    const { ctx, engine, tick } = await harness();
    const fx = createFilterEffect(engine.context);
    engine.bus('sfx').inserts.add(fx);
    const sound = engine.register(ctx.createBuffer(1, 48, 48000) as never);
    engine.play(sound, { bus: 'music', loop: true });
    ctx._advance(10);
    tick();
    expect(allPaths(ctx._sources[0], ctx.destination).some((r) => r.includes(fx.filter as never)))
      .toBe(false);
  });

  it('cancels a transition in flight on dispose', async () => {
    const { engine, timers } = await harness();
    const before = timers.size;
    engine.bus('music').inserts.add(createFilterEffect(engine.context));
    expect(timers.size).toBe(before + 1);
    engine.dispose();
    expect(timers.size).toBe(0);
  });
});
