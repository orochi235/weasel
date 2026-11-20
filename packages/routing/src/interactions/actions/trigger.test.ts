import { describe, expect, it, vi } from 'vitest';
import { ActionDisabledReason, type Action } from './action';
import { ActionsNode } from './ActionsProvider';
import { dynamicActionId } from './actionIds';

describe('ActionsRegistry.trigger', () => {
  it('asks enabled at the world point its params carry', () => {
    const run = vi.fn();
    const seen: unknown[] = [];
    const rightHalf: Action = {
      id: 'test.right-half',
      label: 'Right half',
      enabled: (_deps, at) => {
        seen.push(at);
        return at && at.x > 0 ? true : ActionDisabledReason.NotApplicable;
      },
      invoker: { timing: 'immediate', run },
    };
    const { registry } = new ActionsNode(null, true, () => null);
    registry.register(rightHalf);
    expect(registry.trigger(dynamicActionId('test.right-half'), { world: { x: 5, y: 7 } })).toBe(true);
    expect(registry.trigger(dynamicActionId('test.right-half'), { world: { x: -5, y: 7 } })).toBe(false);
    expect(registry.trigger(dynamicActionId('test.right-half'), {})).toBe(false);
    expect(seen).toEqual([{ x: 5, y: 7 }, { x: -5, y: 7 }, undefined]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('answers false when run passes', () => {
    const { registry } = new ActionsNode(null, true, () => null);
    registry.register({ id: 'test.pass', label: 'Pass', invoker: { timing: 'immediate', run: () => 'pass' } });
    expect(registry.trigger('test.pass')).toBe(false);
  });

  it('reads paramsOf at the active scope, where trigger runs', () => {
    const run = vi.fn();
    const root = new ActionsNode(null, true, () => null);
    const canvas = new ActionsNode(root, true, () => null);
    canvas.mount();
    canvas.activate();
    root.registry.register({ id: 'test.insert', label: 'Insert', invoker: { timing: 'immediate', run } });
    canvas.registry.tune('test.insert', { params: { kind: 'ellipse' } });
    root.registry.trigger(dynamicActionId('test.insert'));
    expect(run.mock.calls[0]![1]).toEqual({ kind: 'ellipse' });
    expect(root.registry.paramsOf(dynamicActionId('test.insert'))).toEqual({ kind: 'ellipse' });
  });
});
