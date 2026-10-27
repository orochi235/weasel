import { describe, expect, it, vi } from 'vitest';
import { ActionDisabledReason, type Action } from './action';
import { ActionsNode } from './ActionsProvider';

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
    expect(registry.trigger('test.right-half', { worldX: 5, worldY: 7 })).toBe(true);
    expect(registry.trigger('test.right-half', { worldX: -5, worldY: 7 })).toBe(false);
    expect(registry.trigger('test.right-half', { worldX: 5 })).toBe(false);
    expect(seen).toEqual([{ x: 5, y: 7 }, { x: -5, y: 7 }, undefined]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('answers false when run passes', () => {
    const { registry } = new ActionsNode(null, true, () => null);
    registry.register({ id: 'test.pass', label: 'Pass', invoker: { timing: 'immediate', run: () => 'pass' } });
    expect(registry.trigger('test.pass')).toBe(false);
  });
});
