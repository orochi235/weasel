import { describe, expect, it, vi } from 'vitest';
import { createSetTextOp } from './setText';

describe('createSetTextOp', () => {
  it('applies the new text to the adapter', () => {
    const setText = vi.fn();
    const op = createSetTextOp({ id: 'a', from: 'old', to: 'new' });
    op.apply({ setText });
    expect(setText).toHaveBeenCalledWith('a', 'new');
  });

  it('inverts back to the original text', () => {
    const setText = vi.fn();
    const op = createSetTextOp({ id: 'a', from: 'old', to: 'new' });
    op.invert().apply({ setText });
    expect(setText).toHaveBeenCalledWith('a', 'old');
  });

  it('preserves label and coalesceKey through inversion', () => {
    const op = createSetTextOp({
      id: 'a',
      from: 'x',
      to: 'y',
      label: 'Edit text',
      coalesceKey: 'edit:a',
    });
    const inv = op.invert();
    expect(inv.label).toBe('Edit text');
    expect(inv.coalesceKey).toBe('edit:a');
  });
});
