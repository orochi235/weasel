import { describe, expect, it, vi } from 'vitest';
import { advance, type ClockState, clampTime, createClock, spanOf } from './clock';

const state = (over: Partial<ClockState> = {}): ClockState => ({
  time: 0,
  playing: true,
  loop: true,
  rate: 1,
  span: { start: 0, end: 1000 },
  ...over,
});

describe('spanOf', () => {
  it('runs from start for duration, starting at zero when start is left out', () => {
    expect(spanOf({ duration: 2000 })).toEqual({ start: 0, end: 2000 });
    expect(spanOf({ duration: 1000, start: -300 })).toEqual({ start: -300, end: 700 });
  });

  it('collapses a negative or non-finite duration to an empty span rather than one running backward', () => {
    expect(spanOf({ duration: -5 })).toEqual({ start: 0, end: 0 });
    expect(spanOf({ duration: Number.NaN, start: 10 })).toEqual({ start: 10, end: 10 });
  });
});

describe('clampTime', () => {
  it('holds a time inside the span', () => {
    const span = { start: -300, end: 700 };
    expect(clampTime(span, -1000)).toBe(-300);
    expect(clampTime(span, 5000)).toBe(700);
    expect(clampTime(span, 12)).toBe(12);
    expect(clampTime(span, Number.NaN)).toBe(-300);
  });
});

describe('advance', () => {
  it('moves by the elapsed time times the rate', () => {
    expect(advance(state({ time: 100 }), 50).time).toBe(150);
    expect(advance(state({ time: 100, rate: 2 }), 50).time).toBe(200);
    expect(advance(state({ time: 100, rate: 0.25 }), 40).time).toBe(110);
  });

  it('leaves a paused clock alone', () => {
    const paused = state({ time: 100, playing: false });
    expect(advance(paused, 500)).toBe(paused);
  });

  it('wraps past the end back into the span when looping, keeping the overshoot', () => {
    expect(advance(state({ time: 900 }), 250)).toMatchObject({ time: 150, playing: true });
    const lead = state({ time: 600, span: { start: -300, end: 700 } });
    expect(advance(lead, 200)).toMatchObject({ time: -200, playing: true });
  });

  it('wraps an overshoot longer than the whole span', () => {
    expect(advance(state({ time: 0 }), 3500).time).toBe(500);
  });

  it('stops at the end, paused, when not looping', () => {
    expect(advance(state({ time: 900, loop: false }), 250)).toMatchObject({ time: 1000, playing: false });
  });

  it('pauses an empty span where it stands', () => {
    expect(advance(state({ time: 5, span: { start: 5, end: 5 } }), 100)).toMatchObject({ time: 5, playing: false });
  });
});

describe('createClock', () => {
  it('opens paused at the span start, with the declared loop and rate', () => {
    const clock = createClock({ duration: 1000, start: -300, loop: false, rate: 2 });
    expect(clock.get()).toEqual({ time: -300, playing: false, loop: false, rate: 2, span: { start: -300, end: 700 } });
  });

  it('loops at rate 1 when the spec says nothing', () => {
    expect(createClock({ duration: 1000 }).get()).toMatchObject({ loop: true, rate: 1 });
  });

  it('opens at a given time, clamped into the span', () => {
    expect(createClock({ duration: 1000 }, 400).get().time).toBe(400);
    expect(createClock({ duration: 1000 }, 9000).get().time).toBe(1000);
  });

  it('notifies on every change and not on a no-op', () => {
    const clock = createClock({ duration: 1000 });
    const listener = vi.fn();
    clock.subscribe(listener);
    clock.pause();
    expect(listener).not.toHaveBeenCalled();
    clock.play();
    clock.tick(10);
    clock.seek(500);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('starts over from the span start when played from the end', () => {
    const clock = createClock({ duration: 1000, start: -300 }, 700);
    clock.play();
    expect(clock.get()).toMatchObject({ time: -300, playing: true });
  });

  it('clamps a seek into the span', () => {
    const clock = createClock({ duration: 1000 });
    clock.seek(-50);
    expect(clock.get().time).toBe(0);
    clock.seek(2000);
    expect(clock.get().time).toBe(1000);
  });

  it('ignores a rate that is not a positive finite number', () => {
    const clock = createClock({ duration: 1000 });
    clock.setRate(0);
    clock.setRate(Number.NaN);
    clock.setRate(-1);
    expect(clock.get().rate).toBe(1);
    clock.setRate(4);
    expect(clock.get().rate).toBe(4);
  });

  it('follows a new span to its start while nothing has moved the playhead, and clamps into it after', () => {
    const clock = createClock({ duration: 1000 });
    clock.setSpan({ start: -300, duration: 2000 });
    expect(clock.get()).toMatchObject({ time: -300, span: { start: -300, end: 1700 } });
    clock.seek(1500);
    clock.setSpan({ duration: 800 });
    expect(clock.get()).toMatchObject({ time: 800, span: { start: 0, end: 800 } });
  });

  it('goes back to the declared span when the override is lifted, and takes a redeclared one under no override', () => {
    const clock = createClock({ duration: 1000 });
    clock.setSpan({ duration: 300 });
    clock.setSpan(null);
    expect(clock.get().span).toEqual({ start: 0, end: 1000 });
    clock.declare({ duration: 400, start: 100 });
    expect(clock.get().span).toEqual({ start: 100, end: 500 });
    clock.setSpan({ duration: 50 });
    clock.declare({ duration: 900 });
    expect(clock.get().span).toEqual({ start: 0, end: 50 });
  });

  it('treats a time it was opened at as a moved playhead', () => {
    const clock = createClock({ duration: 1000 }, 400);
    clock.setSpan({ start: -300, duration: 2000 });
    expect(clock.get().time).toBe(400);
  });
});
