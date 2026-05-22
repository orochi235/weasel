import { describe, it, expect, vi } from 'vitest';
import { makeToolSelectAction } from './toolSelect';

describe('makeToolSelectAction', () => {
  it('produces an action with id `tool.select.<id>` and scope hotkey', () => {
    const a = makeToolSelectAction('rect', { key: 'r' });
    expect(a.id).toBe('tool.select.rect');
    expect(a.scope).toBe('hotkey');
  });

  it('defaultBinding is a key spec with the given key', () => {
    const a = makeToolSelectAction('rect', { key: 'r' });
    expect(a.defaultBinding).toEqual({ kind: 'key', key: 'r' });
  });

  it('respects modifier flags in the key spec', () => {
    const a = makeToolSelectAction('selectMod', { key: 'a', mod: true });
    expect(a.defaultBinding).toEqual({ kind: 'key', key: 'a', mod: true });
  });

  it('respects alt and shift flags', () => {
    const a = makeToolSelectAction('special', { key: 's', alt: true, shift: true });
    expect(a.defaultBinding).toEqual({
      kind: 'key',
      key: 's',
      alt: true,
      shift: true,
    });
  });

  it('run calls ctx.activeTool.setActive with the toolId', () => {
    const setActiveSpy = vi.fn();
    const activeTool = {
      active: 'select',
      hotkeyStack: [],
      setActive: setActiveSpy,
      pushHotkey: () => {},
      popHotkey: () => {},
    };
    const action = makeToolSelectAction('rect', { key: 'r' });
    if (!action.invoker || action.invoker.timing !== 'immediate') {
      throw new Error('Expected immediate invoker');
    }
    action.invoker.run({ activeTool } as any);
    expect(setActiveSpy).toHaveBeenCalledWith('rect');
  });

  it('has timing immediate', () => {
    const a = makeToolSelectAction('rect', { key: 'r' });
    expect(a.invoker?.timing).toBe('immediate');
  });

  it('has requires: activeTool', () => {
    const a = makeToolSelectAction('rect', { key: 'r' });
    expect((a as any).requires).toEqual(['activeTool']);
  });
});
