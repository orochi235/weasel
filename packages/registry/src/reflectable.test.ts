import { describe, expect, it, vi } from 'vitest';
import { createReflectable, type Reflection } from './reflectable';

describe('createReflectable', () => {
  it('answers get/has for what was set, and lists entries in first-registration order', () => {
    const r = createReflectable<number>();
    r.set('b', 2);
    r.set('a', 1);
    expect(r.get('a')).toBe(1);
    expect(r.has('b')).toBe(true);
    expect(r.has('c')).toBe(false);
    expect(r.entries().map((e) => [e.key, e.value])).toEqual([['b', 2], ['a', 1]]);
  });

  it('set replaces the live value in place, keeping the key position and recording no conflict', () => {
    const r = createReflectable<number>();
    r.set('a', 1);
    r.set('b', 2);
    r.set('a', 3);
    expect(r.entries().map((e) => [e.key, e.value, e.shadowed.length])).toEqual([['a', 3, 0], ['b', 2, 0]]);
  });

  it('push stacks registrants, newest live, and reports the displaced ones as shadowed', () => {
    const r = createReflectable<string>();
    r.push('k', 'first', { source: 'kit' });
    r.push('k', 'second', { source: 'app' });
    const [entry] = r.entries();
    expect(entry).toMatchObject({ key: 'k', value: 'second', source: 'app' });
    expect(entry!.shadowed).toEqual([{ value: 'first', source: 'kit' }]);
  });

  it('releasing the live registrant uncovers the one it displaced', () => {
    const r = createReflectable<string>();
    r.push('k', 'base');
    const release = r.push('k', 'override');
    release();
    expect(r.get('k')).toBe('base');
    expect(r.entries()[0]!.shadowed).toEqual([]);
  });

  it('releasing a displaced registrant removes only it, leaving the live one alone', () => {
    const r = createReflectable<string>();
    r.push('k', 'a');
    const releaseB = r.push('k', 'b');
    r.push('k', 'c');
    releaseB();
    expect(r.get('k')).toBe('c');
    expect(r.entries()[0]!.shadowed.map((s) => s.value)).toEqual(['a']);
  });

  it('removes the key once its last registrant is released, and a second release is a no-op', () => {
    const r = createReflectable<string>();
    const release = r.push('k', 'only');
    release();
    release();
    expect(r.has('k')).toBe(false);
    expect(r.entries()).toEqual([]);
  });

  it('a release outliving a set that replaced its value does nothing', () => {
    const r = createReflectable<string>();
    const release = r.push('k', 'pushed');
    r.set('k', 'replaced');
    release();
    expect(r.get('k')).toBe('replaced');
  });

  it('reports the live registrant by identity, the same object it shows as shadowed once displaced', () => {
    const r = createReflectable<string>();
    r.push('k', 'first', { source: 'kit' });
    const { live } = r.entries()[0]!;
    expect(live).toEqual({ value: 'first', source: 'kit' });
    expect(Object.isFrozen(live)).toBe(true);
    r.bump();
    expect(r.entries()[0]!.live).toBe(live);
    r.push('k', 'second');
    expect(r.entries()[0]!.shadowed[0]).toBe(live);
  });

  it('release removes exactly the registrant it is handed, live or shadowed', () => {
    const r = createReflectable<string>();
    r.push('k', 'a');
    r.push('k', 'b');
    r.push('k', 'c');
    const [entry] = r.entries();
    expect(r.release('k', entry!.shadowed[0]!)).toBe(true);
    expect(r.entries()[0]!.shadowed.map((s) => s.value)).toEqual(['b']);
    expect(r.release('k', entry!.live)).toBe(true);
    expect(r.get('k')).toBe('b');
    expect(r.release('k', r.entries()[0]!.live)).toBe(true);
    expect(r.has('k')).toBe(false);
  });

  it('release takes a registrant written by set', () => {
    const r = createReflectable<string>();
    r.push('k', 'pushed');
    r.push('k', 'over');
    r.set('k', 'replaced');
    expect(r.release('k', r.entries()[0]!.live)).toBe(true);
    expect(r.get('k')).toBe('pushed');
  });

  it('release and the closure push returned agree: either one makes the other a no-op', () => {
    const r = createReflectable<string>();
    const listener = vi.fn();
    const releaseA = r.push('k', 'a');
    const releaseB = r.push('k', 'b');
    const { live, shadowed } = r.entries()[0]!;
    r.subscribe(listener);
    expect(r.release('k', live)).toBe(true);
    releaseB();
    releaseA();
    expect(r.release('k', shadowed[0]!)).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(r.has('k')).toBe(false);
  });

  it('release refuses a registrant that is not under that key, and notifies nobody', () => {
    const r = createReflectable<string>();
    r.push('a', 'same', { source: 'kit' });
    r.push('b', 'same', { source: 'kit' });
    const [a] = r.entries();
    const listener = vi.fn();
    r.subscribe(listener);
    expect(r.release('b', a!.live)).toBe(false);
    expect(r.release('missing', a!.live)).toBe(false);
    expect(r.release('a', { value: 'same', source: 'kit' })).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    expect(r.has('a') && r.has('b')).toBe(true);
  });

  it('keeps release off the read-only view', () => {
    expect('release' in createReflectable<number>().reflection).toBe(false);
  });

  it('delete drops every registrant of a key; clear drops every key', () => {
    const r = createReflectable<number>();
    r.push('a', 1);
    r.push('a', 2);
    r.set('b', 3);
    expect(r.delete('a')).toBe(true);
    expect(r.delete('a')).toBe(false);
    expect(r.has('a')).toBe(false);
    r.clear();
    expect(r.entries()).toEqual([]);
  });

  it('bumps the version and notifies subscribers on every change, and not on a read', () => {
    const r = createReflectable<number>();
    const listener = vi.fn();
    const unsubscribe = r.subscribe(listener);
    const v0 = r.getVersion();
    const release = r.push('a', 1);
    release();
    r.set('a', 2);
    r.bump();
    r.get('a');
    r.entries();
    expect(listener).toHaveBeenCalledTimes(4);
    expect(r.getVersion()).toBe(v0 + 4);
    unsubscribe();
    r.set('b', 1);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('does not notify for a delete, clear or release that changed nothing', () => {
    const r = createReflectable<number>();
    const listener = vi.fn();
    r.subscribe(listener);
    r.delete('missing');
    r.clear();
    expect(listener).not.toHaveBeenCalled();
  });

  it('hands back the same entries array until something changes — a stable useSyncExternalStore snapshot', () => {
    const r = createReflectable<number>();
    r.set('a', 1);
    const first = r.entries();
    expect(r.entries()).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    r.bump();
    expect(r.entries()).not.toBe(first);
  });

  it('keeps notifying the rest when one subscriber throws', () => {
    const r = createReflectable<number>();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    r.subscribe(() => { throw new Error('boom'); });
    r.subscribe(after);
    r.set('a', 1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('exposes a read-only view that tracks the owner', () => {
    const r = createReflectable<number>();
    const view: Reflection<number> = r.reflection;
    r.set('a', 1);
    expect(view.get('a')).toBe(1);
    expect(view.entries()).toBe(r.entries());
    expect(view.getVersion()).toBe(r.getVersion());
    expect('set' in view).toBe(false);
  });

  it('accepts non-string keys', () => {
    const r = createReflectable<string, object>();
    const k = {};
    r.set(k, 'v');
    expect(r.get(k)).toBe('v');
  });
});
