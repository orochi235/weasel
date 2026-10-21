import { describe, expect, it, vi } from 'vitest';
import { createFakeAudioContext, type FakeGain, type FakeNode } from '../testing/fakeAudioContext';
import { createFader } from './fader';

const MS = 20;

function harness({ running = true } = {}) {
  const ctx = createFakeAudioContext();
  if (running) ctx.state = 'running';
  const timers = new Map<number, () => void>();
  let nextId = 0;
  const from = ctx.createGain() as FakeNode;
  const to = ctx.createGain() as FakeNode;
  const fader = createFader(
    ctx as never,
    {
      setTimer: (cb) => { nextId += 1; timers.set(nextId, cb); return nextId; },
      clearTimer: (h) => { timers.delete(h as number); },
    },
    from as never,
    to as never,
  );
  const gain = fader.gain as never as FakeGain;
  const runTimers = (): void => {
    const due = [...timers.values()];
    timers.clear();
    for (const f of due) f();
  };
  return { ctx, from, to, fader, gain, runTimers };
}

describe('createFader', () => {
  it('starts silent and wired through', () => {
    const { from, to, gain } = harness();
    expect(gain.gain.value).toBe(0);
    expect(from.connectedTo).toContain(gain);
    expect(gain.connectedTo).toContain(to);
  });

  it('opens with a ramp anchored at its current value', () => {
    const { ctx, fader, gain } = harness();
    const t = ctx.currentTime;
    fader.open(MS);
    expect(gain.gain.holds.at(-1)).toEqual({ value: 0, at: t });
    expect(gain.gain.ramps.at(-1)).toEqual({ value: 1, at: t + 0.02 });
  });

  it('closes, then cuts and reports done', () => {
    const { ctx, from, fader, gain, runTimers } = harness();
    const done = vi.fn();
    fader.close(MS, done);
    runTimers();
    expect(done).not.toHaveBeenCalled();
    expect(from.connectedTo).toContain(gain);
    ctx._advance(MS);
    runTimers();
    expect(done).toHaveBeenCalledTimes(1);
    expect(from.connectedTo).not.toContain(gain);
  });

  it('cut cancels a pending close', () => {
    const { ctx, from, fader, gain, runTimers } = harness();
    const done = vi.fn();
    fader.close(MS, done);
    fader.cut();
    ctx._advance(MS);
    runTimers();
    expect(done).not.toHaveBeenCalled();
    expect(from.connectedTo).not.toContain(gain);
    expect(gain.connectedTo).toHaveLength(0);
  });

  it('finishes a zero-length close synchronously', () => {
    const { from, fader, gain } = harness();
    const done = vi.fn();
    fader.close(0, done);
    expect(done).toHaveBeenCalledTimes(1);
    expect(from.connectedTo).not.toContain(gain);
  });

  it('finishes a close at once when the context is not running', () => {
    const { from, fader, gain } = harness({ running: false });
    const done = vi.fn();
    fader.close(MS, done);
    expect(done).toHaveBeenCalledTimes(1);
    expect(from.connectedTo).not.toContain(gain);
  });

  it('close is idempotent', () => {
    const { ctx, fader, runTimers } = harness();
    const done = vi.fn();
    fader.close(MS, done);
    fader.close(MS, done);
    ctx._advance(MS);
    runTimers();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('a second close keeps its done', () => {
    const { ctx, fader, runTimers } = harness();
    const first = vi.fn();
    const second = vi.fn();
    fader.close(MS, first);
    fader.close(MS, second);
    ctx._advance(MS);
    runTimers();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    const late = vi.fn();
    fader.close(MS, late);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it("leaves a consumer's other edges from the source alone", () => {
    const { ctx, from, to, fader, runTimers } = harness();
    const other = ctx.createGain() as FakeNode;
    from.connect(other as never);
    fader.close(MS);
    ctx._advance(MS);
    runTimers();
    expect(from.connectedTo).toEqual([other]);
    expect(to.connectedTo).toEqual([]);
  });
});
