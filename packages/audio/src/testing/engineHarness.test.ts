import { describe, expect, it } from 'vitest';
import { createFilterEffect } from '../effects';
import { engineHarness } from './engineHarness';
import { fakeTimers } from './fakeTimers';

describe('engineHarness', () => {
  it('keeps the scheduler running beside another timer the engine arms', async () => {
    const { ctx, engine, run, starts } = await engineHarness();
    // An insert's fade waits through its own timer, beside the scheduler's pass.
    engine.bus('sfx').inserts.add(createFilterEffect(engine.context, { frequency: 800 }));
    await run(200);
    engine.playNote({ pitch: 220, when: engine.now() + 300 });
    await run(400);
    expect(ctx._oscillators).toHaveLength(1);
    expect(starts()).toEqual([500]);
  });
});

describe('fakeTimers', () => {
  it('clears only the timer whose handle it is given', () => {
    const t = fakeTimers();
    const ran: string[] = [];
    const a = t.setTimer(() => ran.push('a'));
    t.setTimer(() => ran.push('b'));
    t.clearTimer(a);
    t.fire();
    expect(ran).toEqual(['b']);
  });

  it('runs a timer armed by a callback on the next fire, not this one', () => {
    const t = fakeTimers();
    const ran: string[] = [];
    t.setTimer(() => { ran.push('a'); t.setTimer(() => ran.push('b')); });
    t.fire();
    expect(ran).toEqual(['a']);
    t.fire();
    expect(ran).toEqual(['a', 'b']);
  });
});
