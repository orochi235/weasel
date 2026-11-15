import { describe, expect, it } from 'vitest';
import type { LayerListItem } from './layerListProps';
import { soloLayer } from './layerSolo';

const TREE: LayerListItem[] = [
  { id: 'g', label: 'Group', visible: false, children: [{ id: 'g1', label: 'One' }, { id: 'g2', label: 'Two' }] },
  { id: 'b', label: 'Beta' },
  { id: 'bg', label: 'Background', fixed: true },
];

describe('soloLayer', () => {
  it('shows a nested layer alone, with its container, and leaves fixed rows alone', () => {
    expect(soloLayer(TREE, 'g1', 'visible')).toEqual({ g: true, g2: false, b: false });
  });

  it('leaves the layers inside the one shown alone as they are', () => {
    expect(soloLayer(TREE, 'g', 'visible')).toEqual({ g: true, b: false });
  });

  it('shows every layer again when the layer is already alone', () => {
    const alone = [{ ...TREE[0]!, visible: true }, { ...TREE[1]!, visible: false }, TREE[2]!];
    expect(soloLayer(alone, 'g', 'visible')).toEqual({ b: true });
  });

  it('locks a layer alone, its container unlocked', () => {
    const locked = TREE.map((it) => ({ ...it, locked: true }));
    expect(soloLayer(locked, 'b', 'locked')).toEqual({ g: false });
    expect(soloLayer(TREE, 'g1', 'locked')).toEqual({ g1: true });
  });
});
