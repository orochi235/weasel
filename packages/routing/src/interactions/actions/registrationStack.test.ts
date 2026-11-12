import { describe, expect, it } from 'vitest';
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
