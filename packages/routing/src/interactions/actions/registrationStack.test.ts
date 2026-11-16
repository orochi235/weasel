import { describe, expect, it, vi } from 'vitest';
import type { Action } from './action';
import { ActionsNode } from './ActionsProvider';
import { createDepRegistry } from './depNode';

// One object registered twice under one name, with another between: each release takes out its own registration,
// so releasing the earlier one leaves the later copy live over the one between.
describe('a release takes out its own registration of an object registered twice', () => {
  it('in the actions registry', () => {
    const { registry } = new ActionsNode(null, true, () => null);
    const shared: Action = { id: 'test.shared', label: 'Shared', invoker: { timing: 'immediate', run: () => {} } };
    const between: Action = { ...shared, label: 'Between' };
    const first = registry.register(shared);
    registry.register(between);
    registry.register(shared);
    first();
    expect(registry.list().find((a) => a.id === 'test.shared')?.label).toBe('Shared');
  });

  it('in the dep registry', () => {
    const deps = createDepRegistry();
    const shared = (() => 'shared') as never;
    const first = deps.register('selection' as never, shared);
    deps.register('selection' as never, (() => 'between') as never);
    deps.register('selection' as never, shared);
    first();
    expect(deps.get('selection' as never)).toBe('shared');
  });
});

describe('the actions registry reflection', () => {
  const action = (label: string): Action => ({ id: 'test.reflected', label, invoker: { timing: 'immediate', run: () => {} } });

  it('reflects the actions registered at its own node, stacked newest live, without warning of a clash', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = new ActionsNode(null, true, () => null);
    const scope = new ActionsNode(root, false, () => null);
    const base = action('Base');
    const over = action('Over');
    root.registry.register(action('Root'));
    scope.registry.register(base);
    const release = scope.registry.register(over);
    const reflection = scope.registry.reflection!;
    expect(reflection.get('test.reflected')).toBe(over);
    expect(reflection.entries()[0]!.shadowed.map((s) => s.value)).toEqual([base]);
    release();
    expect(reflection.get('test.reflected')).toBe(base);
    expect(root.registry.reflection!.entries().map((e) => e.value.label)).toEqual(['Root']);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps an id\'s place in the list when it is released and registered again in one tick', async () => {
    const { registry } = new ActionsNode(null, true, () => null);
    const first = { ...action('First'), id: 'test.first' };
    const off = registry.register(first);
    registry.register({ ...action('Second'), id: 'test.second' });
    off();
    registry.register({ ...first, label: 'First again' });
    expect(registry.list().map((a) => a.id)).toEqual(['test.first', 'test.second']);
    registry.unregister('test.first');
    await Promise.resolve();
    registry.register(first);
    expect(registry.list().map((a) => a.id)).toEqual(['test.second', 'test.first']);
  });
});
