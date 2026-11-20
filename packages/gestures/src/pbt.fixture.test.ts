import { describe, expect, it } from 'vitest';
import { fakeClock } from './pbt.fixture';

describe('fakeClock', () => {
  it('never fires a timer an earlier one in the same step cleared', () => {
    const clock = fakeClock();
    const fired: string[] = [];
    let second: unknown;
    clock.setTimer(() => { fired.push('first'); clock.clearTimer(second); }, 10);
    second = clock.setTimer(() => fired.push('second'), 20);
    clock.advance(30);
    expect(fired).toEqual(['first']);
    expect(clock.pending()).toBe(0);
  });

  it('fires due timers in the order they fall due, each at its own time', () => {
    const clock = fakeClock();
    const fired: [string, number][] = [];
    clock.setTimer(() => fired.push(['late', clock.now()]), 30);
    clock.setTimer(() => fired.push(['early', clock.now()]), 10);
    clock.advance(40);
    expect(fired).toEqual([['early', 10], ['late', 30]]);
    expect(clock.now()).toBe(40);
  });

  it('fires a timer a callback sets when it falls inside the step, and keeps one past it', () => {
    const clock = fakeClock();
    const fired: number[] = [];
    clock.setTimer(() => {
      clock.setTimer(() => fired.push(clock.now()), 5);
      clock.setTimer(() => fired.push(clock.now()), 50);
    }, 10);
    clock.advance(20);
    expect(fired).toEqual([15]);
    expect(clock.pending()).toBe(1);
  });
});
