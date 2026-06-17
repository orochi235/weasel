import { describe, expect, it, vi } from 'vitest';
import { createSetDataOp } from './setData';
import { rebuildOp } from './registry';

interface D { color: string }

describe('createSetDataOp', () => {
  it('applies the new data to the adapter', () => {
    const setData = vi.fn();
    const op = createSetDataOp<D>({ id: 'a', from: { color: 'red' }, to: { color: 'blue' } });
    op.apply({ setData });
    expect(setData).toHaveBeenCalledWith('a', { color: 'blue' });
  });

  it('inverts back to the original data', () => {
    const setData = vi.fn();
    const op = createSetDataOp<D>({ id: 'a', from: { color: 'red' }, to: { color: 'blue' } });
    op.invert().apply({ setData });
    expect(setData).toHaveBeenCalledWith('a', { color: 'red' });
  });

  it('preserves label and coalesceKey through inversion', () => {
    const op = createSetDataOp<D>({
      id: 'a',
      from: { color: 'red' },
      to: { color: 'blue' },
      label: 'Edit data',
      coalesceKey: 'edit:a',
    });
    const inv = op.invert();
    expect(inv.label).toBe('Edit data');
    expect(inv.coalesceKey).toBe('edit:a');
  });

  it('round-trips through the registry', () => {
    const a = vi.fn();
    const b = vi.fn();
    const original = createSetDataOp<D>({ id: 'a', from: { color: 'red' }, to: { color: 'blue' } });
    original.apply({ setData: a });
    const rebuilt = rebuildOp(original.name!, original.args)!;
    rebuilt.apply({ setData: b });
    expect(b.mock.calls).toEqual(a.mock.calls);
  });
});
