import { describe, expect, it, vi } from 'vitest';
import { createEmitter } from './emitter';

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
