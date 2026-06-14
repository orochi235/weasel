import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from './eventBus';

describe('EventBus', () => {
  it('fires registered listener for matching event', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.on('foo', fn);
    bus.emit('foo');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not fire on different event name', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.on('foo', fn);
    bus.emit('bar');
    expect(fn).not.toHaveBeenCalled();
  });

  it('unsubscribe stops further calls', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    const off = bus.on('foo', fn);
    off();
    bus.emit('foo');
    expect(fn).not.toHaveBeenCalled();
  });

  it('multiple listeners for same event all fire', () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('foo', a);
    bus.on('foo', b);
    bus.emit('foo');
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it('clear removes all listeners', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.on('foo', fn);
    bus.clear();
    bus.emit('foo');
    expect(fn).not.toHaveBeenCalled();
  });
});
