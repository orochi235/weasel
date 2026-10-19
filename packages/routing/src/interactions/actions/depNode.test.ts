import { describe, it, expect, vi } from 'vitest';
import { createDepRegistry, type DepName } from '../../index';
import { DepNode } from './depNode';

// The stock registry, from the React-free entry, for a dispatcher driven
// without a provider tree.
describe('createDepRegistry', () => {
  it('answers a registered source, reading it at get time', () => {
    const deps = createDepRegistry();
    let n = 1;
    deps.register('selection' as never, (() => n) as never);
    n = 2;
    expect(deps.get('selection' as never)).toBe(2);
  });

  it('restores the displaced source when the newer one leaves', () => {
    const deps = createDepRegistry();
    deps.register('selection' as never, (() => 'old') as never);
    const release = deps.register('selection' as never, (() => 'new') as never);
    expect(deps.get('selection' as never)).toBe('new');
    release();
    expect(deps.get('selection' as never)).toBe('old');
  });

  it('answers undefined for a name nothing registered', () => {
    expect(createDepRegistry().get('selection' as never)).toBeUndefined();
  });

  it('keeps each registry to itself', () => {
    const a = createDepRegistry();
    const b = createDepRegistry();
    a.register('selection' as never, (() => 1) as never);
    expect(b.get('selection' as never)).toBeUndefined();
  });
});

describe('a source reading the one it displaced', () => {
  it('reads the source beneath it in its own stack, then in the scopes above', () => {
    const root = new DepNode(null, true);
    const scope = new DepNode(root, false);
    const wrap = (tag: string) => ((below: () => unknown) => `${tag}(${String(below())})`) as never;
    root.registry.register('selection' as DepName, (() => 'base') as never);
    scope.registry.register('selection' as DepName, wrap('a'));
    const release = scope.registry.register('selection' as DepName, wrap('b'));
    expect(scope.registry.get('selection' as DepName)).toBe('b(a(base))');
    release();
    expect(scope.registry.get('selection' as DepName)).toBe('a(base)');
  });

  it('reads undefined below the bottom source', () => {
    const deps = createDepRegistry();
    deps.register('selection' as never, ((below: () => unknown) => below() ?? 'none') as never);
    expect(deps.get('selection' as never)).toBe('none');
  });
});

describe('dep registry change notices', () => {
  it('tells subscribers when a source is registered, released, or said to have changed', () => {
    const registry = createDepRegistry();
    const heard = vi.fn();
    const off = registry.subscribe!(heard);

    const release = registry.register('gate' as DepName, () => true as never);
    expect(heard).toHaveBeenCalledTimes(1);
    registry.changed!();
    expect(heard).toHaveBeenCalledTimes(2);
    release();
    expect(heard).toHaveBeenCalledTimes(3);
    release();
    expect(heard).toHaveBeenCalledTimes(3);

    off();
    registry.changed!();
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it('reaches a subscriber on another node of the same tree', () => {
    const root = new DepNode(null, true);
    const scope = new DepNode(root, false);
    const heard = vi.fn();
    root.registry.subscribe!(heard);
    scope.registry.changed!();
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe('dep registry listing', () => {
  it('lists each name it answers, how many scopes up its live source sits, and how many are stacked there', () => {
    const root = new DepNode(null, true);
    const scope = new DepNode(root, false);
    root.registry.register('selection' as DepName, (() => 1) as never);
    root.registry.register('gate' as DepName, (() => 1) as never);
    scope.registry.register('gate' as DepName, (() => 2) as never);
    scope.registry.register('gate' as DepName, (() => 3) as never);
    expect(scope.registry.list!()).toEqual([
      { name: 'gate', depth: 0, stacked: 2 },
      { name: 'selection', depth: 1, stacked: 1 },
    ]);
    expect(root.registry.list!()).toEqual([
      { name: 'gate', depth: 0, stacked: 1 },
      { name: 'selection', depth: 0, stacked: 1 },
    ]);
  });
});
