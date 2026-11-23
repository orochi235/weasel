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

describe('prefJudge', () => {
  it('reads an entry holding null as its item’s default', () => {
    const item = num('Item');
    const holds = prefJudge({ name: '', children: {} }, () => undefined, { item, value: null });
    expect(holds({ from: 'item', path: '', is: 5 }, 'showIf')).toBe(true);
  });
});
