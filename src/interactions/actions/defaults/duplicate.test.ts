import { describe, it, expect } from 'vitest';
import { duplicateAction } from './duplicate';

describe('duplicateAction (descriptor)', () => {
  it('id="duplicate", label="Duplicate"', () => {
    expect(duplicateAction.id).toBe('duplicate');
    expect(duplicateAction.label).toBe('Duplicate');
  });

  it('gestureBinding = { kind: "key", key: "d", mods: { mod: true } }', () => {
    expect(duplicateAction.gestureBinding).toEqual({ kind: 'key', key: 'd', mods: { mod: true } });
  });

  it('invoker.timing = "immediate"', () => {
    expect(duplicateAction.invoker?.timing).toBe('immediate');
  });
});
