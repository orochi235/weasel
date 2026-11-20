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

describe('createSetTextOp: no-op report', () => {
  it('reports a no-op when the node already holds the text', () => {
    const op = createSetTextOp({ id: 'a', from: 'old', to: 'same' });
    expect(op.apply({ setText: vi.fn(), getNode: () => ({ id: 'a', text: 'same' }) })).toBe(false);
  });

  it('reports a change when a stale `from` equals `to` but the node differs', () => {
    const op = createSetTextOp({ id: 'a', from: 'x', to: 'x' });
    expect(op.apply({ setText: vi.fn(), getNode: () => ({ id: 'a', text: 'y' }) })).toBeUndefined();
  });

  it('falls back to comparing `from` and `to` without a getNode', () => {
    expect(createSetTextOp({ id: 'a', from: 'x', to: 'x' }).apply({ setText: vi.fn() })).toBe(false);
  });
});
