import { describe, expect, it } from 'vitest';
import { createClock } from './clock';
import { holdAt, holdPosition, shownInPass } from './hold';

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
    const shown = shownInPass(h.clock);
    expect(shown).toBe(1100);
    const back = createClock({ duration: 3000, loop: true, origin: -500 });
    expect(holdAt(back, shown).pending()).toBeNull();
    expect(shownInPass(back.clock)).toBe(1100);
    const end = createClock({ duration: 3000, loop: true });
    end.clock.seek(6000, 'end');
    const atEnd = shownInPass(end.clock);
    holdAt(back, atEnd - 500);
    expect([back.clock.pass, back.clock.phase]).toEqual([0, 1]);
  });
  it('shows a pass boundary as the pass the clock reads it in, as its phase does', () => {
    const h = createClock({ duration: 100, loop: 3, origin: 10 });
    h.clock.seek(200);
    expect([h.clock.phase, shownInPass(h.clock)]).toEqual([0, 10]);
    h.clock.seek(200, 'end');
    expect([h.clock.phase, shownInPass(h.clock)]).toEqual([1, 110]);
    h.clock.seek(300);
    expect([h.clock.phase, shownInPass(h.clock)]).toEqual([1, 110]);
    const open = createClock({ origin: 5 });
    open.clock.seek(1234);
    expect(shownInPass(open.clock)).toBe(1239);
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

describe('holdPosition', () => {
  it('comes back in the pass it stood in, with what is left of the run', () => {
    const h = createClock({ duration: 1000, loop: 3 });
    const hold = holdPosition(h, { elapsed: 2500 });
    expect([h.clock.elapsed, h.clock.pass, h.clock.ended]).toEqual([2500, 2, false]);
    expect(hold.pending()).toBeNull();
    holdPosition(h, { elapsed: 3000 });
    expect(h.clock.ended).toBe(true);
  });
  it('stands at the end of a pass another follows when the position did', () => {
    const h = createClock({ duration: 1000, loop: 3 });
    holdPosition(h, { elapsed: 2000, passEnd: true });
    expect([h.clock.pass, h.clock.phase]).toEqual([1, 1]);
  });
  it('waits for a run long enough to reach it, then reaches it', () => {
    const h = createClock({ duration: 1000, loop: 2 });
    const hold = holdPosition(h, { elapsed: 2500 });
    expect(h.clock.elapsed).toBe(2000);
    expect(hold.pending()).toBe(2500);
    h.declare({ duration: 1000, loop: 3 });
    expect([h.clock.elapsed, h.clock.pass]).toEqual([2500, 2]);
    expect(hold.pending()).toBeNull();
  });
  it('converts a position recorded under another span, keeping its pass', () => {
    const h = createClock({ duration: 2000, loop: 3 });
    const hold = holdPosition(h, { elapsed: 2500, duration: 1000 });
    expect([h.clock.elapsed, h.clock.pass]).toEqual([4500, 2]);
    expect(hold.pending()).toBeNull();
    h.clock.duration = 1000;
    expect([h.clock.elapsed, h.clock.pass]).toEqual([2500, 2]);
  });
  it('reports the converted target while a run too short holds it back', () => {
    const h = createClock({ duration: 2000, loop: 2 });
    const hold = holdPosition(h, { elapsed: 2500, duration: 1000 });
    expect(h.clock.elapsed).toBe(4000);
    expect(hold.pending()).toBe(4500);
    h.clock.loop = 3;
    expect(h.clock.elapsed).toBe(4500);
    expect(hold.pending()).toBeNull();
  });
  it('keeps the shown time across a recorded origin, and a pass end', () => {
    const h = createClock({ duration: 1000, loop: 3, origin: 0 });
    holdPosition(h, { elapsed: 1200, origin: -100 });
    expect([h.clock.elapsed, h.clock.pass]).toEqual([1100, 1]);
    holdPosition(h, { elapsed: 1000, duration: 500, passEnd: true });
    expect([h.clock.elapsed, h.clock.pass]).toEqual([1500, 1]);
    holdPosition(h, { elapsed: 1000, duration: 500 });
    expect([h.clock.elapsed, h.clock.pass]).toEqual([2000, 2]);
  });
});

describe('a hold and a ramp', () => {
  it('releases when a ramp starts the held clock', () => {
    const h = createClock({ duration: 1000 });
    const hold = holdAt(h, 500);
    expect(h.clock.ramping).toBe(false);
    h.clock.ramp(1, 300);
    expect(h.clock.ramping).toBe(true);
    // A declaration before the first frame of the ramp, which a hold still in place would answer with a seek.
    h.declare({ duration: 1000, origin: 100 });
    expect(h.clock.elapsed).toBe(400);
    h.clock.sync(0);
    h.clock.sync(100);
    const moved = h.clock.elapsed;
    expect(moved).toBeGreaterThan(400);
    expect(hold.pending()).toBeNull();
    h.declare({ duration: 2000, origin: 100 });
    expect(h.clock.elapsed).toBe(moved);
    h.clock.sync(400);
    expect(h.clock.ramping).toBe(false);
  });
});

describe('holdPosition at an ended run', () => {
  it('reads it as the end of the last pass, as declare does', () => {
    const h = createClock({ duration: 100 });
    holdPosition(h, { elapsed: 100, origin: -10 });
    expect([h.clock.elapsed, shownInPass(h.clock)]).toEqual([90, 90]);
    const d = createClock({ duration: 100, start: 'end' });
    d.declare({ duration: 100, origin: 10 });
    const e = createClock({ duration: 100, origin: 10 });
    holdPosition(e, { elapsed: 100, origin: 0 });
    expect([e.clock.elapsed, shownInPass(e.clock)]).toEqual([d.clock.elapsed, 100]);
  });
  it('keeps the time shown in the last pass across a duration change', () => {
    const h = createClock({ duration: 200 });
    const hold = holdPosition(h, { elapsed: 100, duration: 100 });
    expect([h.clock.elapsed, h.clock.ended]).toEqual([100, false]);
    expect(hold.pending()).toBeNull();
    const l = createClock({ duration: 200, loop: 2 });
    holdPosition(l, { elapsed: 200, duration: 100 });
    expect([l.clock.elapsed, l.clock.pass]).toEqual([300, 1]);
  });
});

describe('pending', () => {
  it('reads a holdAt met when the clock stands where the hold sought, whatever the float round trip', () => {
    const h = createClock({ duration: 1000, origin: 0.7 });
    const hold = holdAt(h, 3.1);
    expect(h.clock.elapsed).toBe(3.1 - 0.7);
    expect(hold.pending()).toBeNull();
  });
  it('reads a holdPosition past its pass end as waiting, as holdAt does', () => {
    const a = createClock({ duration: 1000 });
    const at = holdAt(a, 1500);
    const p = createClock({ duration: 1000 });
    const position = holdPosition(p, { elapsed: 500, origin: 1000 });
    expect([a.clock.elapsed, p.clock.elapsed]).toEqual([1000, 1000]);
    expect(at.pending()).toBe(1500);
    expect(position.pending()).toBe(1500);
    p.clock.duration = 2000;
    expect(p.clock.elapsed).toBe(1500);
    expect(position.pending()).toBeNull();
    const before = createClock({ duration: 1000, origin: 100 });
    expect(holdPosition(before, { elapsed: 50, origin: 0 }).pending()).toBe(-50);
  });
});
