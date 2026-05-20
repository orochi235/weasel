import { describe, it, expect } from 'vitest';
import { escapeAction } from './escape';

describe('escapeAction (descriptor)', () => {
  it('id="escape", label="Escape"', () => {
    expect(escapeAction.id).toBe('escape');
    expect(escapeAction.label).toBe('Escape');
  });

  it('defaultBinding = Escape, gated to [*:initial]', () => {
    expect(escapeAction.defaultBinding).toEqual({
      kind: 'key',
      key: 'Escape',
      phase: [{ channel: '*', phase: 'initial' }],
    });
  });

  it('invoker.timing = "immediate"', () => {
    expect(escapeAction.invoker?.timing).toBe('immediate');
  });
});
