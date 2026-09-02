import { describe, expect, it } from 'vitest';
import { createTimeScale, panWindow, spanFraction, spanPercent, tickTimes, toFraction, toPercent, zoomWindow } from './timeScale';

describe('createTimeScale', () => {
  it('maps the window ends to the track ends', () => {
    const s = createTimeScale({ from: 0, to: 1000 }, 500);
    expect(s.toPx(0)).toBe(0);
    expect(s.toPx(1000)).toBe(500);
    expect(s.toPx(500)).toBe(250);
  });

  it('maps px back to ms', () => {
    const s = createTimeScale({ from: 0, to: 1000 }, 500);
    expect(s.toMs(250)).toBe(500);
    expect(s.toMs(0)).toBe(0);
  });

  it('round-trips through a panned window', () => {
    const s = createTimeScale({ from: 400, to: 900 }, 250);
    expect(s.toMs(s.toPx(650))).toBeCloseTo(650, 9);
  });

  it('survives a zero-width track without dividing by zero', () => {
    const s = createTimeScale({ from: 0, to: 1000 }, 0);
    expect(Number.isFinite(s.toMs(0))).toBe(true);
  });

  it('survives a zero-length window', () => {
    const s = createTimeScale({ from: 500, to: 500 }, 200);
    expect(Number.isFinite(s.toPx(500))).toBe(true);
  });
});

describe('zoomWindow', () => {
  it('holds the anchor time still', () => {
    const w = zoomWindow({ from: 0, to: 1000 }, 250, 0.5, { from: 0, to: 1000 });
    const before = (250 - 0) / 1000;
    const after = (250 - w.from) / (w.to - w.from);
    expect(after).toBeCloseTo(before, 9);
  });

  it('narrows on a factor below 1', () => {
    const w = zoomWindow({ from: 0, to: 1000 }, 500, 0.5, { from: 0, to: 1000 });
    expect(w.to - w.from).toBeCloseTo(500, 9);
  });

  it('never widens past the bounds', () => {
    const w = zoomWindow({ from: 0, to: 1000 }, 500, 4, { from: 0, to: 1000 });
    expect(w.from).toBe(0);
    expect(w.to).toBe(1000);
  });

  it('refuses to collapse below the minimum span', () => {
    let w = { from: 0, to: 1000 };
    for (let i = 0; i < 50; i++) w = zoomWindow(w, 500, 0.5, { from: 0, to: 1000 });
    expect(w.to - w.from).toBeGreaterThan(0);
  });
});

describe('panWindow', () => {
  it('shifts both ends together', () => {
    const w = panWindow({ from: 100, to: 600 }, 50, { from: 0, to: 1000 });
    expect(w).toEqual({ from: 150, to: 650 });
  });

  it('clamps at the bounds without changing the span', () => {
    const w = panWindow({ from: 100, to: 600 }, -400, { from: 0, to: 1000 });
    expect(w.from).toBe(0);
    expect(w.to - w.from).toBe(500);
  });
});

describe('tickTimes', () => {
  it('returns ticks inside the window, ascending', () => {
    const ticks = tickTimes({ from: 0, to: 1000 }, 500, 50);
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks[0]).toBeGreaterThanOrEqual(0);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(1000);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
  });

  it('honours the minimum pixel spacing', () => {
    const w = { from: 0, to: 1000 };
    const ticks = tickTimes(w, 200, 50);
    const s = createTimeScale(w, 200);
    for (let i = 1; i < ticks.length; i++) {
      expect(s.toPx(ticks[i]) - s.toPx(ticks[i - 1])).toBeGreaterThanOrEqual(50 - 1e-9);
    }
  });

  it('uses round numbers, not arbitrary divisions', () => {
    const ticks = tickTimes({ from: 0, to: 1000 }, 500, 90);
    for (const t of ticks) expect(t % 100).toBeCloseTo(0, 9);
  });

  it('returns no ticks for a zero-width track', () => {
    expect(tickTimes({ from: 0, to: 1000 }, 0, 50)).toEqual([]);
  });
});

describe('width-free positioning', () => {
  const win = { from: 200, to: 1200 };

  it('places a time at its fraction of the window', () => {
    expect(toFraction(win, 700)).toBeCloseTo(0.5, 9);
    expect(toPercent(win, 700)).toBe('50%');
  });

  it('runs negative before the window and past 1 after it', () => {
    expect(toFraction(win, 100)).toBeCloseTo(-0.1, 9);
    expect(toFraction(win, 1700)).toBeCloseTo(1.5, 9);
  });

  it('measures a duration without subtracting the window origin', () => {
    expect(spanFraction(win, 250)).toBeCloseTo(0.25, 9);
    expect(spanPercent(win, 250)).toBe('25%');
  });

  it('collapses to zero rather than dividing by a zero span', () => {
    const degenerate = { from: 5, to: 5 };
    expect(toFraction(degenerate, 5)).toBe(0);
    expect(toFraction(degenerate, 99)).toBe(0);
    expect(spanFraction(degenerate, 99)).toBe(0);
    expect(toPercent(degenerate, 99)).toBe('0%');
  });

  it('agrees with createTimeScale once a width is known', () => {
    const scale = createTimeScale(win, 400);
    for (const ms of [200, 450, 700, 1200]) {
      expect(toFraction(win, ms) * 400).toBeCloseTo(scale.toPx(ms), 9);
    }
  });
});
