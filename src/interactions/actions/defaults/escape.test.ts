import { describe, it, expect } from 'vitest';
import { escapeAction } from './escape';

describe('escapeAction (descriptor)', () => {
  it('id="escape", label="Escape"', () => {
    expect(escapeAction.id).toBe('escape');
    expect(escapeAction.label).toBe('Escape');
  });

  it('gestureBinding = { kind: "key", key: "Escape" }', () => {
    expect(escapeAction.gestureBinding).toEqual({ kind: 'key', key: 'Escape' });
  });

  it('invoker.timing = "immediate"', () => {
    expect(escapeAction.invoker?.timing).toBe('immediate');
  });
});
