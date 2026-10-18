import { describe, expect, it, vi } from 'vitest';
import { ActionDisabledReason, type Action } from './action';
import { ActionsNode } from './ActionsProvider';

function setup(action: Action) {
  const { registry } = new ActionsNode(null, true, () => null);
  registry.register(action);
  return registry;
}

describe('ActionsRegistry.preview', () => {
  it('shows what the action would do, with its params, and takes it down once', () => {
    const stop = vi.fn();
    const preview = vi.fn(() => stop);
    const registry = setup({ id: 'test.p', label: 'P', preview });
    const end = registry.preview('test.p', { op: 'union' });
    expect(preview).toHaveBeenCalledWith({}, { op: 'union' });
    end();
    end();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('shows nothing for an action that is disabled, unknown, or has no preview', () => {
    const preview = vi.fn();
    const registry = setup({
      id: 'test.off', label: 'Off', preview, enabled: () => ActionDisabledReason.SelectionRequired,
    });
    registry.register({ id: 'test.plain', label: 'Plain' });
    for (const id of ['test.off', 'test.plain', 'test.nowhere']) registry.preview(id)();
    expect(preview).not.toHaveBeenCalled();
  });

  it('lays the scope\'s tuned params under the ones passed', () => {
    const preview = vi.fn();
    const registry = setup({ id: 'test.t', label: 'T', preview });
    registry.tune('test.t', { params: { strokes: 'filled', op: 'divide' } });
    registry.preview('test.t', { op: 'union' });
    expect(preview).toHaveBeenCalledWith({}, { strokes: 'filled', op: 'union' });
  });

  it('survives a preview that throws, on the way up and on the way down', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const registry = setup({ id: 'test.bad', label: 'Bad', preview: () => { throw new Error('up'); } });
    expect(() => registry.preview('test.bad')()).not.toThrow();
    registry.register({ id: 'test.down', label: 'Down', preview: () => () => { throw new Error('down'); } });
    expect(() => registry.preview('test.down')()).not.toThrow();
    expect(err).toHaveBeenCalledTimes(2);
    err.mockRestore();
  });
});
