import { describe, it, expect } from 'vitest';
import { selectAllAction } from './selectAll';

describe('selectAllAction (descriptor)', () => {
  it('id="selectAll", label="Select All"', () => {
    expect(selectAllAction.id).toBe('selectAll');
    expect(selectAllAction.label).toBe('Select All');
  });

  it('defaultBinding = { kind: "key", key: "a", mods: { mod: true } }', () => {
    expect(selectAllAction.defaultBinding).toEqual({ kind: 'key', key: 'a', mods: { mod: true } });
  });

  it('invoker.timing = "immediate"', () => {
    expect(selectAllAction.invoker?.timing).toBe('immediate');
  });
});
