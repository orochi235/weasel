import { describe, expect, it, vi } from 'vitest';
import { createClock } from './clock';
import { createClockRegistry } from './registry';

describe('createClockRegistry', () => {
  it('publishes a clock under its trial id until released', () => {
    const registry = createClockRegistry();
    const handle = createClock({});
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
    registry.register('t1', createClock({}))();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('leaves a newer registration alone when a stale release runs', () => {
    const registry = createClockRegistry();
    const first = createClock({});
    const second = createClock({});
    const releaseFirst = registry.register('t1', first);
    registry.register('t1', second);
    releaseFirst();
    expect(registry.get('t1')).toBe(second);
  });

  it('lists the shared clock, and each clock once however many trials hold it', () => {
    const shared = createClock({});
    const registry = createClockRegistry(shared);
    expect(registry.shared).toBe(shared);
    registry.register('t1', shared);
    registry.register('t2', shared);
    const own = createClock({});
    registry.register('t3', own);
    expect([...registry.all()]).toEqual([shared, own]);
  });
});
