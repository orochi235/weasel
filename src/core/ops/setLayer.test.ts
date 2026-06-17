import { describe, expect, it, vi } from 'vitest';
import { createSetLayerOp } from './setLayer';
import { rebuildOp } from './registry';

describe('createSetLayerOp', () => {
  it('applies the new layer to the adapter', () => {
    const setLayer = vi.fn();
    const op = createSetLayerOp({ id: 'a', from: 'main', to: 'overlay' });
    op.apply({ setLayer });
    expect(setLayer).toHaveBeenCalledWith('a', 'overlay');
  });

  it('inverts back to the original layer', () => {
    const setLayer = vi.fn();
    const op = createSetLayerOp({ id: 'a', from: 'main', to: 'overlay' });
    op.invert().apply({ setLayer });
    expect(setLayer).toHaveBeenCalledWith('a', 'main');
  });

  it('preserves label and coalesceKey through inversion', () => {
    const op = createSetLayerOp({
      id: 'a',
      from: 'main',
      to: 'overlay',
      label: 'Change layer',
      coalesceKey: 'layer:a',
    });
    const inv = op.invert();
    expect(inv.label).toBe('Change layer');
    expect(inv.coalesceKey).toBe('layer:a');
  });

  it('round-trips through the registry', () => {
    const a = vi.fn();
    const b = vi.fn();
    const original = createSetLayerOp({ id: 'a', from: 'main', to: 'overlay' });
    original.apply({ setLayer: a });
    const rebuilt = rebuildOp(original.name!, original.args)!;
    rebuilt.apply({ setLayer: b });
    expect(b.mock.calls).toEqual(a.mock.calls);
  });
});
