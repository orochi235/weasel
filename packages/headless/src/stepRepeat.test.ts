import { describe, expect, it } from 'vitest';
import type { Scheduler } from './scheduler';
import { createStepRepeat, REPEAT_DELAY_MS, REPEAT_EVERY_MS } from './stepRepeat';

/** A scheduler whose clock moves only when `advance` says. */
function fakeScheduler() {
  let now = 0;
  let timers: { at: number; fn: () => void }[] = [];
  const scheduler: Scheduler = {
    now: () => now,
    set(fn, ms) {
      const t = { at: now + ms, fn };
      timers.push(t);
      return () => { timers = timers.filter((x) => x !== t); };
    },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const next = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      timers = timers.filter((t) => t !== next);
      now = next.at;
      next.fn();
    }
    now = end;
  };
  return { scheduler, advance, pending: () => timers.length };
}

function counter(max = Infinity) {
  let value = 0;
  const step = (k: 1 | -1) => { value = Math.min(max, value + k); };
  const spent = (k: 1 | -1) => k > 0 && value >= max;
  return { step, spent, value: () => value };
}

describe('createStepRepeat', () => {
  it('steps once at start, then after the delay once every interval', () => {
    const { scheduler, advance } = fakeScheduler();
    const c = counter();
    const r = createStepRepeat(c.step, c.spent, { scheduler });
    r.start(1);
    expect(c.value()).toBe(1);
    advance(REPEAT_DELAY_MS - 1);
    expect(c.value()).toBe(1);
    advance(1);
    expect(c.value()).toBe(2);
    advance(REPEAT_EVERY_MS * 3);
    expect(c.value()).toBe(5);
    expect(r.held()).toBe(1);
  });

  it('stops on stop, leaving no timer behind', () => {
    const { scheduler, advance, pending } = fakeScheduler();
    const c = counter();
    const r = createStepRepeat(c.step, c.spent, { scheduler });
    r.start(1);
    r.stop();
    advance(5000);
    expect(c.value()).toBe(1);
    expect(pending()).toBe(0);
    expect(r.held()).toBeNull();
  });

  it('ends the hold itself when the key has nowhere left to go', () => {
    const { scheduler, advance, pending } = fakeScheduler();
    const c = counter(3);
    const r = createStepRepeat(c.step, c.spent, { scheduler });
    r.start(1);
    advance(REPEAT_DELAY_MS + REPEAT_EVERY_MS * 10);
    expect(c.value()).toBe(3);
    expect(pending()).toBe(0);
    expect(r.held()).toBeNull();
  });

  it('reads its delays when it uses them', () => {
    const { scheduler, advance } = fakeScheduler();
    const c = counter();
    const opts = { scheduler, delayMs: 100, everyMs: 10 };
    const r = createStepRepeat(c.step, c.spent, opts);
    r.start(1);
    opts.everyMs = 50;
    advance(100);
    expect(c.value()).toBe(2);
    advance(49);
    expect(c.value()).toBe(2);
    advance(1);
    expect(c.value()).toBe(3);
  });

  it('replaces a hold with a new start', () => {
    const { scheduler, advance, pending } = fakeScheduler();
    const c = counter();
    const r = createStepRepeat(c.step, c.spent, { scheduler });
    r.start(1);
    r.start(-1);
    expect(c.value()).toBe(0);
    expect(pending()).toBe(1);
    advance(REPEAT_DELAY_MS);
    expect(c.value()).toBe(-1);
  });

  it('starts no repeat when its first step ends the hold', () => {
    const { scheduler, pending } = fakeScheduler();
    const r: ReturnType<typeof createStepRepeat<number>> = createStepRepeat<number>(() => r.stop(), () => false, { scheduler });
    r.start(1);
    expect(pending()).toBe(0);
  });
});
