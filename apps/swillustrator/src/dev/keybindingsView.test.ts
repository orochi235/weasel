import { describe, it, expect } from 'vitest';
import { lookupShortcutByToolId } from './keybindingsView';

describe('lookupShortcutByToolId', () => {
  it('returns the keyDown spec from the tool.select.<id> action when present', () => {
    const actions = [
      { id: 'tool.select.rect', defaultBinding: { kind: 'key', key: 'r' } },
      { id: 'tool.select.hand', defaultBinding: { kind: 'key', key: 'h' } },
    ];
    expect(lookupShortcutByToolId('rect', actions as never)).toEqual({ key: 'r' });
    expect(lookupShortcutByToolId('hand', actions as never)).toEqual({ key: 'h' });
  });

  it('returns undefined when no tool.select.* action exists for the id', () => {
    expect(lookupShortcutByToolId('pen', [] as never)).toBeUndefined();
  });

  it('includes modifier flags when set on the action binding', () => {
    const actions = [
      { id: 'tool.select.rect', defaultBinding: { kind: 'key', key: 'r', mod: true } },
    ];
    expect(lookupShortcutByToolId('rect', actions as never)).toEqual({ key: 'r', mod: true });
  });

  it('returns undefined when the defaultBinding is not a key spec (e.g. key-held)', () => {
    const actions = [
      { id: 'tool.select.weird', defaultBinding: { kind: 'key-held', key: ' ' } },
    ];
    expect(lookupShortcutByToolId('weird', actions as never)).toBeUndefined();
  });
});
