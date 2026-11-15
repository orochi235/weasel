import { describe, expect, it, vi } from 'vitest';
import { createExtensionRegistry, ExtensionConflictError, type ExtensionRegistry } from './extensionRegistry';

const make = (parent?: ExtensionRegistry<string>) =>
  createExtensionRegistry<string>({ kind: 'thing', ...(parent ? { parent } : {}) });

describe('createExtensionRegistry', () => {
  it('is idempotent on the same value, holding the id until every release runs', () => {
    const r = make();
    const a = r.register('x', 'one');
    const b = r.register('x', 'one');
    a();
    expect(r.get('x')).toBe('one');
    a(); // a second call of one release does nothing
    expect(r.get('x')).toBe('one');
    b();
    expect(r.has('x')).toBe(false);
  });

  it('throws on a different value unless the call replaces', () => {
    const r = make();
    const first = r.register('x', 'one');
    expect(() => r.register('x', 'two')).toThrow(ExtensionConflictError);
    expect(r.get('x')).toBe('one');
    const second = r.register('x', 'two', { replace: true });
    expect(r.get('x')).toBe('two');
    first(); // displaced: its release no longer holds the id
    expect(r.get('x')).toBe('two');
    second();
    expect(r.has('x')).toBe(false);
  });

  it('keeps isolated registries apart under the same id', () => {
    const a = make();
    const b = make();
    a.register('x', 'for a');
    b.register('x', 'for b');
    expect([a.get('x'), b.get('x')]).toEqual(['for a', 'for b']);
  });

  it('resolves a parent’s ids for every child, and shadows one only on replace', () => {
    const shared = make();
    const one = make(shared);
    const two = make(shared);
    shared.register('x', 'shared');
    expect([one.get('x'), two.get('x')]).toEqual(['shared', 'shared']);
    expect(() => one.register('x', 'mine')).toThrow(ExtensionConflictError);
    const off = one.register('x', 'mine', { replace: true });
    expect([one.get('x'), two.get('x')]).toEqual(['mine', 'shared']);
    expect(one.entries().map((e) => [e.key, e.value])).toEqual([['x', 'mine']]);
    off();
    expect(one.get('x')).toBe('shared');
    expect(one.own.has('x')).toBe(false);
  });

  it('reports a parent’s changes to a child’s subscribers', () => {
    const shared = make();
    const child = make(shared);
    const heard = vi.fn();
    const off = child.subscribe(heard);
    const v = child.getVersion();
    shared.register('y', 'later');
    expect(heard).toHaveBeenCalledTimes(1);
    expect(child.getVersion()).toBeGreaterThan(v);
    expect(child.entries().map((e) => e.key)).toEqual(['y']);
    off();
  });

  it('clear drops its own ids and leaves outstanding releases inert', () => {
    const r = make();
    const off = r.register('x', 'one');
    r.clear();
    expect(r.has('x')).toBe(false);
    r.register('x', 'two');
    off();
    expect(r.get('x')).toBe('two');
  });

  it('compares with `same` when given one', () => {
    const r = createExtensionRegistry<{ v: number }>({ kind: 'thing', same: (a, b) => a.v === b.v });
    r.register('x', { v: 1 });
    expect(() => r.register('x', { v: 1 })).not.toThrow();
    expect(() => r.register('x', { v: 2 })).toThrow(/thing "x"/);
  });
});
