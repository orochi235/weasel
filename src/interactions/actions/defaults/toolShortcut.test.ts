import { describe, it, expect, vi } from 'vitest';
import { makeToolShortcutAction } from './toolShortcut';

describe('makeToolShortcutAction', () => {
  it('produces an action with id `tool.shortcut.<id>` and scope hotkey', () => {
    const a = makeToolShortcutAction('rect', { key: 'r' }, vi.fn());
    expect(a.id).toBe('tool.shortcut.rect');
    expect(a.scope).toBe('hotkey');
  });

  it('defaultBinding is a key spec with the given key', () => {
    const a = makeToolShortcutAction('rect', { key: 'r' }, vi.fn());
    expect(a.defaultBinding).toEqual({ kind: 'key', key: 'r' });
  });

  it('respects modifier flags in the key spec', () => {
    const a = makeToolShortcutAction('selectMod', { key: 'a', mod: true }, vi.fn());
    expect(a.defaultBinding).toEqual({ kind: 'key', key: 'a', mod: true });
  });

  it('respects alt and shift flags', () => {
    const a = makeToolShortcutAction('special', { key: 's', alt: true, shift: true }, vi.fn());
    expect(a.defaultBinding).toEqual({
      kind: 'key',
      key: 's',
      alt: true,
      shift: true,
    });
  });

  it('run calls trigger with `tool.activate.<toolId>`', () => {
    const trigger = vi.fn().mockReturnValue(true);
    const action = makeToolShortcutAction('rect', { key: 'r' }, trigger);
    if (!action.invoker || action.invoker.timing !== 'immediate') {
      throw new Error('Expected immediate invoker');
    }
    action.invoker.run({} as any);
    expect(trigger).toHaveBeenCalledWith('tool.activate.rect');
  });

  it('has timing immediate', () => {
    const a = makeToolShortcutAction('rect', { key: 'r' }, vi.fn());
    expect(a.invoker?.timing).toBe('immediate');
  });

  it('has no requires field (no dep-bag needed; trigger is a closure)', () => {
    const a = makeToolShortcutAction('rect', { key: 'r' }, vi.fn());
    expect((a as any).requires).toBeUndefined();
  });
});
