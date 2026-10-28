import { describe, expect, it } from 'vitest';
import { createClock } from './clock';
import { holdAt, holdElapsed, shownInPass } from './hold';

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
  it('waits at the end of the first pass for a time past it', () => {
    const h = createClock({ duration: 1000, loop: true });
    const hold = holdAt(h, 2500);
    expect([h.clock.elapsed, h.clock.pass, h.clock.phase]).toEqual([1000, 0, 1]);
    expect(hold.pending()).toBe(2500);
    h.clock.duration = 3000;
    expect(h.clock.elapsed).toBe(2500);
    expect(hold.pending()).toBeNull();
  });
  it('round-trips the time a looping clock shows within its pass', () => {
    const h = createClock({ duration: 3000, loop: true, origin: -500 });
    h.clock.seek(7600);
    const shown = shownInPass(h.clock.origin, h.clock.elapsed, h.clock.duration);
    expect(shown).toBe(1100);
    const back = createClock({ duration: 3000, loop: true, origin: -500 });
    expect(holdAt(back, shown).pending()).toBeNull();
    expect(shownInPass(back.clock.origin, back.clock.elapsed, back.clock.duration)).toBe(1100);
    const end = createClock({ duration: 3000, loop: true });
    end.clock.seek(6000, 'end');
    const atEnd = shownInPass(0, end.clock.elapsed, 3000);
    holdAt(back, atEnd - 500);
    expect([back.clock.pass, back.clock.phase]).toEqual([0, 1]);
  });
  it('holds a time on a pass boundary of a looping clock as the end of the pass before', () => {
    const h = createClock({ duration: 1000, loop: true });
    const hold = holdAt(h, 1000);
    expect(h.clock.elapsed).toBe(1000);
    expect([h.clock.pass, h.clock.phase]).toEqual([0, 1]);
    expect(hold.pending()).toBeNull();
    holdAt(h, 0);
    expect([h.clock.pass, h.clock.phase]).toEqual([0, 0]);
  });
});

describe('holdElapsed', () => {
  it('comes back in the pass it stood in, with what is left of the run', () => {
    const h = createClock({ duration: 1000, loop: 3 });
    const hold = holdElapsed(h, { elapsed: 2500 });
    expect([h.clock.elapsed, h.clock.pass, h.clock.ended]).toEqual([2500, 2, false]);
    expect(hold.pending()).toBeNull();
    holdElapsed(h, { elapsed: 3000 });
    expect(h.clock.ended).toBe(true);
  });
  it('stands at the end of a pass another follows when the position did', () => {
    const h = createClock({ duration: 1000, loop: 3 });
    holdElapsed(h, { elapsed: 2000, passEnd: true });
    expect([h.clock.pass, h.clock.phase]).toEqual([1, 1]);
  });
  it('waits for a run long enough to reach it, then reaches it', () => {
    const h = createClock({ duration: 1000, loop: 2 });
    const hold = holdElapsed(h, { elapsed: 2500 });
    expect(h.clock.elapsed).toBe(2000);
    expect(hold.pending()).toBe(2500);
    h.declare({ duration: 1000, loop: 3 });
    expect([h.clock.elapsed, h.clock.pass]).toEqual([2500, 2]);
    expect(hold.pending()).toBeNull();
  });
  it('converts a position recorded under another span, keeping its pass', () => {
    const h = createClock({ duration: 2000, loop: 3 });
    const hold = holdElapsed(h, { elapsed: 2500, duration: 1000 });
    expect([h.clock.elapsed, h.clock.pass]).toEqual([4500, 2]);
    expect(hold.pending()).toBeNull();
    h.clock.duration = 1000;
    expect([h.clock.elapsed, h.clock.pass]).toEqual([2500, 2]);
  });
  it('reports the converted target while a run too short holds it back', () => {
    const h = createClock({ duration: 2000, loop: 2 });
    const hold = holdElapsed(h, { elapsed: 2500, duration: 1000 });
    expect(h.clock.elapsed).toBe(4000);
    expect(hold.pending()).toBe(4500);
    h.clock.loop = 3;
    expect(h.clock.elapsed).toBe(4500);
    expect(hold.pending()).toBeNull();
  });
  it('keeps the shown time across a recorded origin, and a pass end', () => {
    const h = createClock({ duration: 1000, loop: 3, origin: 0 });
    holdElapsed(h, { elapsed: 1200, origin: -100 });
    expect([h.clock.elapsed, h.clock.pass]).toEqual([1100, 1]);
    holdElapsed(h, { elapsed: 1000, duration: 500, passEnd: true });
    expect([h.clock.elapsed, h.clock.pass]).toEqual([1500, 1]);
    holdElapsed(h, { elapsed: 1000, duration: 500 });
    expect([h.clock.elapsed, h.clock.pass]).toEqual([2000, 2]);
  });
});
