import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostedAnimator } from '../createHostedAnimator';
import { createTarget, type Target } from '../target';
import { createTargetTable } from '../targetTable';
import type { Track } from '../timeline/types';

function hosted() {
  let now = 0;
  const h = createHostedAnimator({ now: () => now, requestFrame: () => {} });
  return { animator: h.animator, tick: (t: number) => { now = t; h.tick(t); } };
}

const ramp = (target: Target<unknown>, to: unknown = 1000): Track =>
  ({ kind: 'sampled', keys: [{ t: 0, value: typeof to === 'number' ? 0 : [0] }, { t: 1000, value: to }], target } as Track);

afterEach(() => { vi.restoreAllMocks(); });

describe("a timeline track's hold on its target", () => {
  it('leaves when the target is stopped, and moves it no more', () => {
    const a = hosted();
    let v = 0;
    const target = createTarget<number>({ get: () => v, set: (n) => { v = n; } });
    a.animator.timeline({ tracks: [ramp(target as Target<unknown>)] });
    a.tick(0);
    a.tick(100);
    expect(target.read()).toBeCloseTo(100);
    target.stop();
    expect(target.active).toBe(false);
    expect(v).toBeCloseTo(100);
    a.tick(200);
    expect(target.read()).toBeCloseTo(100);
  });

  it('leaves when its target\'s show throws, which is then logged once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = hosted();
    let v = 0;
    const target = createTarget<number>({ get: () => v, set: (n) => { v = n; }, show: () => { throw new Error('show'); } });
    a.animator.timeline({ tracks: [ramp(target as Target<unknown>)] });
    for (const t of [0, 16, 32, 48]) a.tick(t);
    expect(target.active).toBe(false);
    expect(error.mock.calls.filter(([m]) => String(m).includes("target's show threw"))).toHaveLength(1);
  });

  it('leaves when its row is removed from the table', () => {
    const a = hosted();
    const table = createTargetTable({ axes: 1 });
    const row = table.add([0]);
    a.animator.timeline({ tracks: [ramp(table.target(row) as Target<unknown>, [1000])] });
    a.tick(0);
    a.tick(100);
    expect(table.target(row).read()[0]).toBeCloseTo(100);
    table.remove(row);
    const again = table.add([5]);
    a.tick(200);
    expect(again).toBe(row);
    expect(table.target(again).read()).toEqual([5]);
    expect(table.shown[0]).toBe(5);
  });
});
