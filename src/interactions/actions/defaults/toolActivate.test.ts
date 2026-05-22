import { describe, it, expect, vi } from 'vitest';
import { makeToolActivateAction } from './toolActivate';

describe('makeToolActivateAction', () => {
  it('produces an action with id `tool.activate.<id>`', () => {
    const a = makeToolActivateAction('rect');
    expect(a.id).toBe('tool.activate.rect');
  });

  it('has no defaultBinding', () => {
    const a = makeToolActivateAction('rect');
    expect(a.defaultBinding).toBeUndefined();
  });

  it('has no scope', () => {
    const a = makeToolActivateAction('rect');
    expect(a.scope).toBeUndefined();
  });

  it('has requires: [activeTool]', () => {
    const a = makeToolActivateAction('rect');
    expect((a as any).requires).toEqual(['activeTool']);
  });

  it('run calls activeTool.setActive with the toolId', () => {
    const setActive = vi.fn();
    const activeTool = {
      active: 'select',
      hotkeyStack: [],
      setActive,
      pushHotkey: () => {},
      popHotkey: () => {},
    };
    const action = makeToolActivateAction('rect');
    if (!action.invoker || action.invoker.timing !== 'immediate') {
      throw new Error('Expected immediate invoker');
    }
    action.invoker.run({ activeTool } as any);
    expect(setActive).toHaveBeenCalledWith('rect');
  });

  it('has timing immediate', () => {
    const a = makeToolActivateAction('rect');
    expect(a.invoker?.timing).toBe('immediate');
  });

  it('run is a no-op when activeTool is absent from deps', () => {
    const action = makeToolActivateAction('rect');
    if (!action.invoker || action.invoker.timing !== 'immediate') {
      throw new Error('Expected immediate invoker');
    }
    // Should not throw
    action.invoker.run({} as any);
  });
});
