import { describe, expect, it } from 'vitest';
import { createHostedAnimator } from '../createHostedAnimator';
import { createTarget } from '../target';

/** A hosted animator whose host keeps one frame request, as a frame loop does. */
function hosted() {
  let now = 0;
  let pending = false;
  const h = createHostedAnimator({
    now: () => now, requestFrame: () => { pending = true; }, cancelFrame: () => { pending = false; },
  });
  return {
    ...h,
    pending: () => pending,
    tick: (t: number) => { now = t; pending = false; h.tick(t); },
  };
}

describe('animator.cancelAll', () => {
  it('keeps the frame asked for by an animation a cancel report starts', () => {
    const a = hosted();
    const seen: number[] = [];
    a.animator.tween({ from: 0, to: 1, ms: 100, onTick: () => {} });
    a.tick(0);
    let once = true;
    a.animator.watch((e) => {
      if (e.type !== 'cancel' || !once) return;
      once = false;
      a.animator.tween({ from: 0, to: 100, ms: 100, easing: 'linear', onTick: (v) => seen.push(v) });
    });
    a.animator.cancelAll();
    expect(a.pending()).toBe(true);
    a.tick(10);
    a.tick(60);
    expect(seen.at(-1)).toBeCloseTo(60);
  });

  it('cancels the frame though a target setter throws as its animation commits', () => {
    const a = hosted();
    let fail = false;
    const target = createTarget<number>({ get: () => 0, set: () => { if (fail) throw new Error('set'); } });
    a.animator.tween({ target, to: 10, ms: 100 });
    a.tick(0);
    a.tick(10);
    fail = true;
    expect(() => a.animator.cancelAll()).toThrow('set');
    expect(a.pending()).toBe(false);
  });

  it('leaves a hosted animator disposed though a target setter throws', () => {
    const a = hosted();
    let fail = false;
    const target = createTarget<number>({ get: () => 0, set: () => { if (fail) throw new Error('set'); } });
    a.animator.tween({ target, to: 10, ms: 100 });
    a.animator.colorOverrides.set('x', 'fill', [1, 1, 1, 1]);
    a.tick(0);
    fail = true;
    expect(() => a.dispose()).toThrow('set');
    expect(a.animator.colorOverrides.get('x', 'fill')).toBeUndefined();
    const seen: number[] = [];
    a.animator.tween({ from: 0, to: 1, ms: 10, onTick: (v) => seen.push(v) });
    expect(a.pending()).toBe(false);
  });
});
describe('animator.cancel', () => {
  it("cancels another animator's handle in that animator, never one of its own with the same id", () => {
    const a = hosted();
    const b = hosted();
    const ha = a.animator.tween({ from: 0, to: 1, ms: 100, onTick: () => {} });
    const hb = b.animator.tween({ from: 0, to: 1, ms: 100, onTick: () => {} });
    expect(ha.id).toBe(hb.id);
    b.animator.cancel(ha);
    expect(b.animator.isActive()).toBe(true);
    expect(a.animator.isActive()).toBe(false);
  });
});
