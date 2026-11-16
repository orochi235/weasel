import { describe, expect, it, vi } from 'vitest';
import { createEmitter, createKeyedEmitter } from './emitter';

describe('createEmitter', () => {
  it('calls each listener with the arguments, in subscription order', () => {
    const e = createEmitter<[number]>();
    const seen: string[] = [];
    e.subscribe((n) => seen.push(`a${n}`));
    e.subscribe((n) => seen.push(`b${n}`));
    e.emit(1);
    expect(seen).toEqual(['a1', 'b1']);
  });

  it('holds a listener once however often it subscribes, and drops it on unsubscribe', () => {
    const e = createEmitter();
    const fn = vi.fn();
    e.subscribe(fn);
    const off = e.subscribe(fn);
    expect(e.size).toBe(1);
    off();
    e.emit();
    expect(fn).not.toHaveBeenCalled();
    expect(e.size).toBe(0);
  });

  it('leaves a listener that subscribes during a pass for the next one', () => {
    const e = createEmitter();
    const late = vi.fn();
    e.subscribe(() => { e.subscribe(late); });
    e.emit();
    expect(late).not.toHaveBeenCalled();
    e.emit();
    expect(late).toHaveBeenCalledOnce();
  });

  it('calls the listeners held at each emit, however they changed between emits', () => {
    const e = createEmitter();
    const seen: string[] = [];
    const offA = e.subscribe(() => seen.push('a'));
    e.emit();
    e.subscribe(() => seen.push('b'));
    e.emit();
    offA();
    e.emit();
    expect(seen).toEqual(['a', 'a', 'b', 'b']);
  });

  it('does not call a listener unsubscribed earlier in the same pass', () => {
    const e = createEmitter();
    const second = vi.fn();
    let off = () => {};
    e.subscribe(() => off());
    off = e.subscribe(second);
    e.emit();
    expect(second).not.toHaveBeenCalled();
  });

  it('runs the rest when a listener throws, and reports the error instead of throwing it', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const e = createEmitter();
    const after = vi.fn();
    const boom = new Error('boom');
    e.subscribe(() => { throw boom; });
    e.subscribe(after);
    expect(() => e.emit()).not.toThrow();
    expect(after).toHaveBeenCalledOnce();
    expect(logged).toHaveBeenCalledWith(expect.any(String), boom);
    logged.mockRestore();
  });
});

describe('createKeyedEmitter', () => {
  it('calls only the listeners under the key emitted', () => {
    const e = createKeyedEmitter<string, [number]>();
    const a = vi.fn();
    const b = vi.fn();
    e.subscribe('a', a);
    e.subscribe('b', b);
    e.emit('a', 1);
    expect(a).toHaveBeenCalledWith(1);
    expect(b).not.toHaveBeenCalled();
  });

  it('keeps one listener that throws from stopping the rest of its key', () => {
    const e = createKeyedEmitter<string>();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    e.subscribe('k', () => { throw new Error('boom'); });
    e.subscribe('k', after);
    e.emit('k');
    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('lets a stale unsubscribe touch no later subscription to the key', () => {
    const e = createKeyedEmitter<string>();
    const off = e.subscribe('k', () => {});
    off();
    const later = vi.fn();
    e.subscribe('k', later);
    off();
    e.emit('k');
    expect(later).toHaveBeenCalledTimes(1);
  });

  it('forgets a key on clear, and an unsubscribe from before it keeps a new subscriber', () => {
    const e = createKeyedEmitter<string>();
    const old = vi.fn();
    const off = e.subscribe('k', old);
    e.clear('k');
    const later = vi.fn();
    e.subscribe('k', later);
    off();
    e.emit('k');
    expect(old).not.toHaveBeenCalled();
    expect(later).toHaveBeenCalledTimes(1);
    expect(e.size('k')).toBe(1);
  });
});
