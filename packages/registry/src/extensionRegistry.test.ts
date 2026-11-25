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

  it('holds a value its parent already resolves to through the parent, without a copy', () => {
    const parent = make();
    const child = make(parent);
    const heard = vi.fn();
    child.subscribe(heard);
    const offParent = parent.register('x', 'f', { source: 'kit' });
    const version = child.getVersion();
    heard.mockClear();
    const off = child.register('x', 'f', { source: 'plugin' });
    expect([child.getVersion(), heard.mock.calls.length, child.own.has('x')]).toEqual([version, 0, false]);
    expect(child.entries()[0]!.source).toBe('kit');
    parent.register('x', 'g', { replace: true });
    expect(child.get('x')).toBe('g');
    off(); // displaced along with the parent's 'f'
    expect(child.get('x')).toBe('g');
    offParent();
  });

  it('takes over an id its parent drops while the child still holds it', () => {
    const parent = make();
    const child = make(parent);
    const offParent = parent.register('x', 'f');
    parent.register('y', 'p');
    const a = child.register('x', 'f', { source: 'plugin' });
    const b = child.register('x', 'f');
    offParent();
    expect(child.get('x')).toBe('f');
    expect(child.entries().map((e) => [e.key, e.source])).toEqual([['x', 'plugin'], ['y', undefined]]);
    a();
    expect(child.get('x')).toBe('f');
    b();
    expect(child.has('x')).toBe(false);
  });

  it('goes on holding through its parent when the parent releases and registers the id again in one tick', async () => {
    const parent = make();
    const child = make(parent);
    const off = parent.register('x', 'f');
    const mine = child.register('x', 'f');
    off();
    parent.register('x', 'f');
    await Promise.resolve();
    expect(child.own.has('x')).toBe(false);
    parent.register('x', 'g', { replace: true });
    expect(child.get('x')).toBe('g');
    mine();
    expect(child.get('x')).toBe('g');
  });

  it('keeps an id it takes over once the tick passes', async () => {
    const parent = make();
    const child = make(parent);
    const off = parent.register('x', 'f');
    child.register('x', 'f');
    off();
    await Promise.resolve();
    expect(child.own.get('x')).toBe('f');
  });

  it('never tells its listeners an id it holds is gone while it takes it over', () => {
    const parent = make();
    const child = make(parent);
    const seen: (string | undefined)[] = [];
    child.subscribe(() => { seen.push(child.get('x')); });
    const off = parent.register('x', 'f');
    child.register('x', 'f');
    seen.length = 0;
    off();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((v) => v === 'f')).toBe(true);
  });

  it('ends a hold through its parent when it releases it', () => {
    const parent = make();
    const child = make(parent);
    parent.register('x', 'f');
    const off = child.register('x', 'f');
    off();
    parent.register('x', 'g', { replace: true })();
    expect(child.has('x')).toBe(false);
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

  it('keeps a listener\'s own subscription to the parent when its subscription to a child ends', () => {
    const parent = make();
    const child = make(parent);
    const onChange = vi.fn();
    parent.subscribe(onChange);
    child.own.subscribe(onChange);
    child.subscribe(onChange)();
    parent.register('a', 'one');
    expect(onChange).toHaveBeenCalledTimes(1);
    child.register('b', 'two');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('lists its ids and its parent\'s in the order each was first registered', () => {
    const parent = make();
    const child = make(parent);
    child.register('a', 'one');
    parent.register('b', 'two');
    parent.register('c', 'three');
    child.register('c', 'mine', { replace: true });
    expect(child.entries().map((e) => [e.key, e.value])).toEqual([['a', 'one'], ['b', 'two'], ['c', 'mine']]);
  });

  it('keeps an id in place when it is released and registered again in the same tick', async () => {
    const r = make();
    const offX = r.register('x', 'one');
    r.register('y', 'two');
    offX();
    expect(r.has('x')).toBe(false);
    const offAgain = r.register('x', 'one');
    expect(r.entries().map((e) => e.key)).toEqual(['x', 'y']);
    const child = make(r);
    const offA = child.register('a', 'mine');
    child.register('b', 'mine');
    offA();
    child.register('a', 'mine');
    expect(child.entries().map((e) => e.key)).toEqual(['x', 'y', 'a', 'b']);
    offAgain();
    await Promise.resolve();
    r.register('x', 'one');
    expect(r.entries().map((e) => e.key)).toEqual(['y', 'x']);
  });

  it('puts an id it releases at its parent\'s place at once, not a tick later', async () => {
    const parent = make();
    const child = make(parent);
    const off = child.register('x', 'mine');
    parent.register('y', 'p');
    parent.register('x', 'p');
    off();
    const now = child.entries().map((e) => e.key);
    await Promise.resolve();
    parent.register('z', 'p');
    expect(now).toEqual(['y', 'x']);
    expect(child.entries().map((e) => e.key)).toEqual(['y', 'x', 'z']);
  });

  it('orders its ids among those of a parent another module made', () => {
    const made = make();
    const parent: ExtensionRegistry<string> = {
      name: made.name, parent: null, own: made.own, register: made.register, clear: made.clear,
      get: made.get, has: made.has, entries: () => made.entries(), subscribe: made.subscribe, getVersion: made.getVersion,
    };
    const child = make(parent);
    parent.register('a', 'p');
    child.register('x', 'c');
    parent.register('b', 'p');
    expect(child.entries().map((e) => e.key)).toEqual(['a', 'x', 'b']);
  });
});
