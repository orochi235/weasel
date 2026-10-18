import { describe, expect, it, vi } from 'vitest';
import { createSetHiddenOp, createSetLockedOp } from './nodeFlags';
import { rebuildOp } from './registry';

describe.each([
  ['setHidden', createSetHiddenOp],
  ['setLocked', createSetLockedOp],
] as const)('%s op', (method, create) => {
  it('applies the flag through the adapter and inverts back', () => {
    const write = vi.fn();
    const op = create({ id: 'a', from: false, to: true });
    op.apply({ [method]: write });
    op.invert().apply({ [method]: write });
    expect(write.mock.calls).toEqual([['a', true], ['a', false]]);
  });

  it('round-trips through the registry', () => {
    const a = vi.fn();
    const b = vi.fn();
    const original = create({ id: 'a', from: false, to: true, label: 'Hide' });
    original.apply({ [method]: a });
    rebuildOp(original.name!, original.args)!.apply({ [method]: b });
    expect(b.mock.calls).toEqual(a.mock.calls);
  });
});
