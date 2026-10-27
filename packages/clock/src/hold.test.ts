import { describe, expect, it } from 'vitest';
import { createClock } from './clock';
import { holdAt } from './hold';

describe('holdAt', () => {
  it('holds a time the span cannot reach, then reaches it once declared', () => {
    const h = createClock({ duration: 1000 });
    const hold = holdAt(h, 2500);
    expect(h.clock.elapsed).toBe(1000);
    expect(hold.pending()).toBe(2500);
    h.declare({ duration: 3000 });
    expect(h.clock.elapsed).toBe(2500);
    expect(hold.pending()).toBeNull();
  });
  it('follows a duration write', () => {
    const h = createClock({ duration: 1000 });
    const hold = holdAt(h, 2500);
    h.clock.duration = 3000;
    expect(h.clock.elapsed).toBe(2500);
    expect(hold.pending()).toBeNull();
  });
  it('pauses a playing clock', () => {
    const h = createClock({ duration: 1000, rate: 1 });
    holdAt(h, 500);
    expect(h.clock.rate).toBe(0);
    expect(h.clock.elapsed).toBe(500);
  });
  it('releases on a rate change, so a later declare clamps', () => {
    const h = createClock({ duration: 1000 });
    const hold = holdAt(h, 2500);
    h.clock.rate = 1;
    expect(hold.pending()).toBeNull();
    h.clock.rate = 0;
    h.declare({ duration: 3000 });
    expect(h.clock.elapsed).toBe(1000);
  });
  it('releases on a seek by someone else', () => {
    const h = createClock({ duration: 1000 });
    const hold = holdAt(h, 2500);
    h.clock.seek(200);
    expect(hold.pending()).toBeNull();
    h.declare({ duration: 3000 });
    expect(h.clock.elapsed).toBe(200);
  });
  it('null follows the span start across an origin move', () => {
    const h = createClock({ duration: 1000, origin: -500 });
    const hold = holdAt(h, null);
    expect(h.clock.elapsed).toBe(0);
    h.declare({ duration: 1000, origin: 200 });
    expect(h.clock.elapsed).toBe(0);
    expect(hold.pending()).toBeNull();
  });
  it('a hold with an origin keeps the shown time across a move', () => {
    const h = createClock({ duration: 1000, origin: 0 });
    holdAt(h, 800);
    h.declare({ duration: 1000, origin: -100 });
    expect(h.clock.origin + h.clock.elapsed).toBe(800);
  });
  it('release is idempotent and unsubscribes', () => {
    const h = createClock({ duration: 1000 });
    const hold = holdAt(h, 2500);
    hold.release();
    hold.release();
    expect(hold.pending()).toBeNull();
    h.declare({ duration: 3000 });
    expect(h.clock.elapsed).toBe(1000);
  });
  it('never holds a clock that is not seekable', () => {
    const h = createClock({ duration: 1000, seekable: false });
    const hold = holdAt(h, 500);
    expect(hold.pending()).toBeNull();
    expect(h.clock.elapsed).toBe(0);
  });
  it('re-seeks to the held time when the loop count changes the span', () => {
    const h = createClock({ duration: 1000, loop: 2 });
    const hold = holdAt(h, 2500);
    expect(h.clock.elapsed).toBe(2000);
    expect(hold.pending()).toBe(2500);
    h.clock.loop = 3;
    expect(h.clock.elapsed).toBe(2500);
    expect(hold.pending()).toBeNull();
  });
});
