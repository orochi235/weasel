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

describe('an entry of a list or a map read by its path from the root', () => {
  const row = {
    kind: 'object', name: 'Phase', description: '', default: {}, children: { hold: { kind: 'boolean', name: 'Hold', description: '', default: true } as PrefLeaf },
  } as PrefObject;
  const list = (item: PrefLeaf): PrefLeaf => ({ kind: 'list', name: 'Phases', description: '', default: [], item }) as PrefLeaf;
  const map = (item: PrefLeaf): PrefLeaf => ({ kind: 'map', name: 'M', description: '', default: {}, item }) as PrefLeaf;

  it('reads a field the entry omits as the item field’s default, as reading it from the entry does', () => {
    const root: PrefGroup = { name: '', children: { phases: list(row) } };
    expect(prefReader(root, { phases: [{}] })('phases.0.hold')).toBe(true);
    expect(prefJudge(root, () => undefined, { item: row, value: {} })({ from: 'item', path: 'hold' }, 'showIf')).toBe(true);
  });

  it('reads an entry holding null as the item holding nothing, as reading it from the entry does', () => {
    const root: PrefGroup = { name: '', children: { m: map(num('N')) } };
    expect(prefReader(root, { m: { k: null } })('m.k')).toBe(5);
    expect(prefJudge(root, () => undefined, { item: num('N'), value: null })({ from: 'item', path: '', is: 5 }, 'showIf')).toBe(true);
  });

  it('reads an entry holding nothing as the item’s auto value where it starts auto, from the root and from the entry', () => {
    const item = num('N', { auto: { on: true, value: 9 } } as Partial<PrefLeaf>);
    const root: PrefGroup = { name: '', children: { m: map(item) } };
    expect(prefReader(root, { m: { k: null } })('m.k')).toBe(9);
    expect(prefJudge(root, () => undefined, { item, value: undefined })({ from: 'item', path: '', is: 9 }, 'showIf')).toBe(true);
  });

  it('reads no entry where the list holds none', () => {
    const root: PrefGroup = { name: '', children: { phases: list(row) } };
    expect(prefReader(root, { phases: [] })('phases.0.hold')).toBeUndefined();
  });
});

describe('a field of a field an object omits', () => {
  const angle = num('Angle', { default: 0 });
  const nib = { kind: 'object', name: 'Nib', description: '', default: { angle: 45 }, children: { angle } } as PrefObject;
  const width = num('Width', { default: 0 });
  const fill = {
    kind: 'union', name: 'Fill', description: '', tag: 'type', default: { type: 'solid', width: 2 },
    variants: { solid: { kind: 'object', name: 'Solid', description: '', default: { width: 2 }, children: { width } } },
  } as unknown as PrefLeaf;
  const phases = { kind: 'list', name: 'Phases', description: '', default: [7], item: num('Phase') } as PrefLeaf;
  const style = { kind: 'object', name: 'Style', description: '', default: {}, children: { nib, fill, phases } } as PrefObject;
  const read = prefReader({ name: '', children: { style } }, { style: {} });

  it('reads through the default of the field holding it, as the form draws it', () => {
    expect(read('style.nib')).toEqual({ angle: 45 });
    expect(read('style.nib.angle')).toBe(45);
  });

  it('reads a union field’s variant from the union’s default', () => {
    expect(read('style.fill.width')).toBe(2);
    expect(read('style.fill.type')).toBe('solid');
  });

  it('reads a list field’s entries from the list’s default', () => {
    expect(read('style.phases.0')).toBe(7);
  });
});
