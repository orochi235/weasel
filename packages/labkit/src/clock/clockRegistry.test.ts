import { describe, expect, it, vi } from 'vitest';
import { createClockRegistry } from './clockRegistry';
import { createTrialClock } from './trialClock';

describe('createClockRegistry', () => {
  it('publishes a clock under its trial id until released', () => {
    const registry = createClockRegistry();
    const handle = createTrialClock({});
    const release = registry.register('t1', handle);
    expect(registry.get('t1')).toBe(handle);
    expect([...registry.all()]).toEqual([handle]);
    release();
    expect(registry.get('t1')).toBeNull();
  });

  it('notifies on register and release', () => {
    const registry = createClockRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);
    registry.register('t1', createTrialClock({}))();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('leaves a newer registration alone when a stale release runs', () => {
    const registry = createClockRegistry();
    const first = createTrialClock({});
    const second = createTrialClock({});
    const releaseFirst = registry.register('t1', first);
    registry.register('t1', second);
    releaseFirst();
    expect(registry.get('t1')).toBe(second);
  });

  it("lists the lab's clock, and each clock once however many trials hold it", () => {
    const lab = createTrialClock({});
    const registry = createClockRegistry(lab);
    expect(registry.lab).toBe(lab);
    registry.register('t1', lab);
    registry.register('t2', lab);
    const own = createTrialClock({});
    registry.register('t3', own);
    expect([...registry.all()]).toEqual([lab, own]);
  });
});
