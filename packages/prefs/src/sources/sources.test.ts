import { describe, expect, it, vi } from 'vitest';
import { AUTO } from '../autoReset';
import type { PrefGroup } from '../groups';
import type { PrefLeaf } from '../schema';
import { selectionSource } from './selectionSource';
import { recordSource, valuesSource } from './valuesSource';

const SCHEMA = {
  name: 'Settings',
  children: {
    view: {
      name: 'View',
      resettable: true,
      children: {
        gap: { kind: 'number', name: 'Gap', description: '', default: 4, auto: { on: true } },
        grid: { kind: 'boolean', name: 'Grid', description: '', default: true },
        note: { kind: 'note', name: 'Note', description: '', default: '' },
      },
    },
  },
} as unknown as PrefGroup;

describe('valuesSource', () => {
  it('reads a leaf as shown, with its auto state only where the owner keeps one', () => {
    const kept = valuesSource(SCHEMA, () => ({ view: { gap: 9 } }), () => {}, { auto: new Set(['view.gap']), onAutoChange: () => {} });
    expect(kept.valueAt('view.gap')).toEqual({ value: 9, mixed: false, each: [9], auto: true });
    expect(kept.valueAt('view.grid')).toEqual({ value: true, mixed: false, each: [true] });
    const plain = valuesSource(SCHEMA, () => ({ view: { gap: 9 } }), () => {});
    expect(plain.autoAt('view.gap')).toBeUndefined();
  });

  it('resets a group leaf by leaf: unpinning through onAutoChange, pinning through onChange', () => {
    const onChange = vi.fn();
    const onAutoChange = vi.fn();
    const source = valuesSource(SCHEMA, () => ({ view: { gap: 9, grid: false } }), onChange, { auto: new Set(), onAutoChange });
    source.reset(['view']);
    expect(onAutoChange.mock.calls).toEqual([['view.gap', true]]);
    expect(onChange.mock.calls).toEqual([['view.grid', true]]);
    source.write('view.gap', AUTO);
    expect(onAutoChange).toHaveBeenLastCalledWith('view.gap', true);
  });
});

describe('valuesSource reads through its getter', () => {
  it('answers from the values the getter holds now, not those it held when built', () => {
    let values: unknown = { view: { gap: 2 } };
    const source = valuesSource(SCHEMA, () => values, () => {});
    expect(source.valueAt('view.gap').value).toBe(2);
    values = { view: { gap: 5 } };
    expect(source.valueAt('view.gap').value).toBe(5);
  });

  it('shows the default for a leaf holding nothing', () => {
    expect(valuesSource(SCHEMA, () => ({}), () => {}).valueAt('view.gap').value).toBe(4);
  });
});

describe('recordSource', () => {
  it('reads a value as held, and a mixed path as mixed', () => {
    const leaf = { kind: 'number', name: 'Size', description: '', default: 3 } as PrefLeaf;
    const source = recordSource({ 'tools.size': leaf }, { 'tools.size': 7 }, () => {}, { mixed: new Set(['tools.other']) });
    expect(source.valueAt('tools.size')).toEqual({ value: 7, mixed: false, each: [7] });
    expect(source.valueAt('tools.other').mixed).toBe(true);
  });
});

describe('selectionSource', () => {
  const size = { kind: 'number', name: 'Size', description: '', default: 12 } as PrefLeaf;
  const targets = (held: Array<number | undefined>) => {
    const write = vi.fn();
    const reset = vi.fn();
    const source = selectionSource({ leaves: { size }, read: () => held, write, reset });
    return { source, write, reset };
  };

  it('reads one value per target, shared or mixed', () => {
    expect(targets([3, 3]).source.valueAt('size')).toEqual({ value: 3, mixed: false, each: [3, 3] });
    expect(targets([3, 4]).source.valueAt('size')).toEqual({ value: undefined, mixed: true, each: [3, 4] });
  });

  it('shows a target holding nothing as `shown` says', () => {
    expect(targets([undefined]).source.valueAt('size').value).toBe(12);
    const unset = selectionSource({ leaves: { size }, read: () => [undefined], shown: () => undefined, write: () => {}, reset: () => {} });
    expect(unset.valueAt('size').value).toBeUndefined();
  });

  it('writes through `write`, a draft marked so', () => {
    const { source, write } = targets([1]);
    source.write('size', 5, { draft: true });
    expect(write.mock.calls[0]![0]).toBe('size');
    expect(write.mock.calls[0]![1](1)).toBe(5);
    expect(write.mock.calls[0]![2]).toEqual({ draft: true });
  });

  it('resets only what is not at its reset, under the leaf name', () => {
    const at = targets([12, 12]);
    at.source.reset(['size']);
    expect(at.reset).not.toHaveBeenCalled();
    const off = targets([3, 12]);
    off.source.reset(['size']);
    expect(off.reset.mock.calls[0]![1]).toBe('Size');
    expect(off.reset.mock.calls[0]![0].map((w: { path: string }) => w.path)).toEqual(['size']);
  });
});
