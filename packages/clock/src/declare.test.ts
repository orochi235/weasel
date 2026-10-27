import { describe, expect, it } from 'vitest';
import { createClock } from './clock';

describe('clock origin, speed and declare', () => {
  it('shows elapsed 0 at its origin', () => {
    const { clock } = createClock({ duration: 3000, origin: -1000 });
    expect(clock.origin).toBe(-1000);
    expect(clock.elapsed).toBe(0);
  });
  it('declare keeps the shown time when the span moves', () => {
    const h = createClock({ duration: 3000, origin: -1000 });
    h.clock.seek(1500);
    h.declare({ duration: 3000, origin: 0 });
    expect(h.clock.origin + h.clock.elapsed).toBe(500);
  });
  it('declare clamps a shown time the new span cannot hold', () => {
    const h = createClock({ duration: 3000 });
    h.clock.seek(2500);
    h.declare({ duration: 1000 });
    expect(h.clock.elapsed).toBe(1000);
  });
  it('declare leaves a playing clock playing', () => {
    const h = createClock({ duration: 3000, rate: 1 });
    h.declare({ duration: 4000 });
    expect(h.clock.rate).toBe(1);
  });
  it('a paused clock offers its declared speed', () => {
    expect(createClock({ speed: 2 }).clock.speed).toBe(2);
    expect(createClock({}).clock.speed).toBe(1);
  });
  it('declare takes up loop and speed, and notifies', () => {
    const h = createClock({ duration: 1000 });
    let n = 0;
    h.clock.subscribe(() => n++);
    h.declare({ duration: 1000, loop: 2, speed: 4 });
    expect(h.clock.loop).toBe(2);
    expect(h.clock.speed).toBe(4);
    expect(n).toBe(1);
  });
  it('declare moves an infinite run to a finite one, clamped', () => {
    const h = createClock({});
    h.clock.seek(5000);
    h.declare({ duration: 2000 });
    expect(h.clock.elapsed).toBe(2000);
  });
  it('declare leaves rates and seekable alone', () => {
    const h = createClock({ rates: [1, 3], seekable: false });
    h.declare({ duration: 100 });
    expect(h.clock.rates).toEqual([1, 3]);
    expect(h.clock.seekable).toBe(false);
  });
  it('rejects a bad speed or duration', () => {
    expect(() => createClock({ speed: 0 })).toThrow(RangeError);
    expect(() => createClock({ speed: Number.NaN })).toThrow(RangeError);
    const h = createClock({ duration: 100 });
    expect(() => h.declare({ speed: -1 })).toThrow(RangeError);
    expect(() => h.declare({ duration: 0 })).toThrow(RangeError);
  });
});
