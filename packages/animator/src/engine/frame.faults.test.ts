import { describe, expect, it, vi } from 'vitest';
import { hostAnimator } from '../hostAnimator';
import { createTarget } from '../target';
import type { AnimatorEvent } from '../types';

/** An animator on frames the test runs, a tween beside whatever the test starts, and its events. */
function rig() {
  let now = 0;
  let asked = 0;
  const hosted = hostAnimator({ now: () => now, requestFrame: () => { asked += 1; } });
  const events: AnimatorEvent[] = [];
  hosted.animator.watch((e) => { events.push(e); });
  const seen: number[] = [];
  hosted.animator.tween({ from: 0, to: 100, ms: 100, easing: 'linear', onTick: (v) => seen.push(v) });
  let value = 0;
  const target = createTarget({ get: () => value, set: (v: number) => { value = v; } });
  /** Runs a frame at `t`, answering whether it asked for another. */
  const tick = (t: number): boolean => {
    now = t;
    const before = asked;
    hosted.tick(t);
    return asked > before;
  };
  return { animator: hosted.animator, events, seen, target, value: () => value, tick };
}

describe('a frame whose voices or holds throw', () => {
  it('retires a hold whose value throws and keeps the rest running', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = rig();
    let bad = false;
    r.animator.hold({ target: r.target, value: () => { if (bad) throw new Error('bad hold'); return 5; } });
    r.tick(0);
    bad = true;
    expect(r.tick(20)).toBe(true);
    expect(r.events.some((e) => e.type === 'error' && e.animation.kind === 'hold')).toBe(true);
    expect(r.animator.live().some((a) => a.kind === 'hold')).toBe(false);
    r.tick(50);
    expect(r.seen.at(-1)).toBeCloseTo(50);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it('retires a target tween whose interpolate throws and keeps the rest running', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = rig();
    r.tick(0);
    r.animator.tween({
      target: r.target, to: 10, ms: 100,
      interpolate: (a, b, u) => { if (u > 0) throw new Error('bad path'); return a + (b - a) * u; },
    });
    expect(r.tick(20)).toBe(true);
    expect(r.events.some((e) => e.type === 'error' && e.animation.kind === 'tween' && r.animator.live().every((a) => a.id !== e.animation.id))).toBe(true);
    r.tick(50);
    expect(r.seen.at(-1)).toBeCloseTo(50);
    errors.mockRestore();
  });

  it('retires a target tween whose easing throws and keeps the rest running', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = rig();
    r.tick(0);
    r.animator.tween({ target: r.target, to: 10, ms: 100, easing: (u) => { if (u > 0) throw new Error('bad ease'); return u; } });
    expect(r.tick(20)).toBe(true);
    expect(r.events.filter((e) => e.type === 'error')).toHaveLength(1);
    r.tick(50);
    expect(r.seen.at(-1)).toBeCloseTo(50);
    errors.mockRestore();
  });
});
