import { describe, expect, it } from 'vitest';
import type { PrefGroup } from './groups';
import type { PrefLeaf, PrefObject } from './schema';
import { prefJudge, prefReader } from './judge';

const num = (name: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 5, ...extra }) as PrefLeaf;

describe('prefReader', () => {
  it('reads a stored null as nothing held, as the control shows it', () => {
    const root: PrefGroup = { name: '', children: { n: num('N') } };
    const read = prefReader(root, { n: null });
    expect(read('n')).toBe(5);
    expect(prefJudge(root, read)({ path: 'n', atLeast: 1 }, 'showIf')).toBe(true);
  });

  it('reads a paint holding null as no paint', () => {
    const fill = { kind: 'paint', name: 'Fill', description: '', default: '#fff' } as unknown as PrefLeaf;
    expect(prefReader({ name: '', children: { fill } }, { fill: null })('fill')).toBeNull();
  });
});

const stroke = {
  kind: 'object', name: 'Stroke', description: '', default: { width: 1, dash: [4, 2] }, children: { width: num('Width') },
} as PrefObject;

describe('a field an object omits', () => {
  it('reads as absent where the object is held, and as the default’s field where it is not', () => {
    const root: PrefGroup = { name: '', children: { stroke } };
    expect(prefReader(root, { stroke: { width: 2 } })('stroke.dash')).toBeUndefined();
    expect(prefReader(root, {})('stroke.dash')).toEqual([4, 2]);
  });

  it('reads as the default of the leaf describing it, as a form draws it', () => {
    const root: PrefGroup = { name: '', children: { stroke } };
    expect(prefReader(root, { stroke: { dash: [1] } })('stroke.width')).toBe(5);
  });

  it('reads as absent in an entry that holds the object', () => {
    const holds = prefJudge({ name: '', children: {} }, () => undefined, { item: stroke, value: { width: 2 } });
    expect(holds({ from: 'item', path: 'dash' }, 'showIf')).toBe(false);
    expect(prefJudge({ name: '', children: {} }, () => undefined, { item: stroke, value: undefined })({ from: 'item', path: 'dash' }, 'showIf')).toBe(true);
  });
});

describe('prefJudge', () => {
  it('reads an entry holding null as its item’s default', () => {
    const item = num('Item');
    const holds = prefJudge({ name: '', children: {} }, () => undefined, { item, value: null });
    expect(holds({ from: 'item', path: '', is: 5 }, 'showIf')).toBe(true);
  });
});

describe('a split leaf whose selector is split by it', () => {
  it('reads the cycle as no selection rather than recursing', () => {
    const scoped = { $by: 'b', $in: {}, $else: 3 };
    const a = num('A', { scopes: [{ selector: 'b' }], defaultScope: scoped });
    const b = num('B', { scopes: [{ selector: 'a' }], defaultScope: { $by: 'a', $in: {}, $else: 4 } });
    const read = prefReader({ name: '', children: { a, b } }, {});
    expect(read('a')).toBe(3);
    expect(read('b')).toBe(4);
  });
});
