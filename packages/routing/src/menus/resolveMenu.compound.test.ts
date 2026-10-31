import { describe, expect, it, vi } from 'vitest';
import type { MenuColorEntry, MenuEntry, MenuItemEntry, MenuNumberEntry, MenuTextEntry, SubmenuEntry } from '@weasel-js/menu';
import {
  pref, type PrefField, type PrefGroup, type PrefLeaf, type PrefList, type PrefMap, type PrefObject, type PrefPaint,
  type PrefUnion,
} from '@weasel-js/prefs';
import { resolveSchemaMenu, type MenuSources } from './resolveMenu';
import { pathSegment, pathSegments } from './compoundRows';

/** Values held whole at each top-level key, as a prefs store holds them, read at a dotted path. */
function store(initial: Record<string, unknown>, extra: Partial<MenuSources> = {}) {
  const held: Record<string, unknown> = { ...initial };
  const onChange = vi.fn((path: string, value: unknown) => { held[path] = value; });
  const values = (path: string) => {
    let cur: unknown = held;
    for (const seg of path.split('.')) cur = cur !== null && typeof cur === 'object' ? (cur as Record<string, unknown>)[seg] : undefined;
    return cur;
  };
  const src: MenuSources = { actions: () => [], depsFor: () => undefined, trigger: () => true, values, onChange, ...extra };
  return { src, held, onChange };
}

const menu = (children: Record<string, PrefLeaf | PrefGroup>): PrefGroup => ({ name: '', children });
const only = (es: MenuEntry[]) => { expect(es).toHaveLength(1); return es[0]!; };
const sub = (e: MenuEntry) => { expect(e.kind).toBe('submenu'); return e as SubmenuEntry; };
const rowsOf = (e: MenuEntry) => sub(e).entries.filter((x) => x.kind !== 'separator');
const leafOf = <L extends PrefLeaf>(l: Omit<L, 'description'>): L => ({ description: '', ...l }) as unknown as L;

const stroke = leafOf<PrefObject>({
  kind: 'object', name: 'Stroke', default: { width: 1, color: '#000000' },
  children: { width: pref.number('Width', 1), color: pref.color('Color', '#000000') },
});

describe('resolveSchemaMenu: an object leaf', () => {
  it('is a submenu of its fields, which read inside the value and write the object whole', () => {
    const { src, onChange } = store({ stroke: { width: 3, color: '#ff0000' } });
    const e = only(resolveSchemaMenu(menu({ stroke }), src));
    expect(e).toMatchObject({ kind: 'submenu', key: 'stroke', label: 'Stroke' });
    const [width, color] = rowsOf(e) as [MenuNumberEntry, MenuColorEntry];
    expect(width).toMatchObject({ kind: 'number', key: 'stroke.width', value: 3 });
    expect(color).toMatchObject({ kind: 'color', key: 'stroke.color', value: '#ff0000' });
    width.set(5);
    expect(onChange).toHaveBeenLastCalledWith('stroke', { width: 5, color: '#ff0000' });
  });

  it('starts a write from its default when nothing is held', () => {
    const { src, onChange } = store({});
    const [width] = rowsOf(only(resolveSchemaMenu(menu({ stroke }), src))) as [MenuNumberEntry];
    expect(width.value).toBe(1);
    width.set(2);
    expect(onChange).toHaveBeenLastCalledWith('stroke', { width: 2, color: '#000000' });
  });

  it('draws a section among its fields without adding to their paths', () => {
    const boxed = leafOf<PrefObject>({
      kind: 'object', name: 'Box', default: {},
      children: { size: pref.section('Size', { w: pref.number('W', 0) }) },
    });
    const { src, onChange } = store({ box: { w: 4 } });
    const [w] = rowsOf(only(resolveSchemaMenu(menu({ box: boxed }), src))) as [MenuNumberEntry];
    expect(w).toMatchObject({ key: 'box.w', value: 4 });
    w.set(6);
    expect(onChange).toHaveBeenLastCalledWith('box', { w: 6 });
  });

  it('disables its fields when it is a readout', () => {
    const { src } = store({ stroke: { width: 3 } });
    const [width] = rowsOf(only(resolveSchemaMenu(menu({ stroke: { ...stroke, readout: true } }), src)));
    expect(width).toMatchObject({ disabled: true });
  });
});

describe('resolveSchemaMenu: a list leaf', () => {
  const caps = leafOf<PrefList>({ kind: 'list', name: 'Caps', default: [], item: pref.number('Cap', 0), maxItems: 3 });

  it('is a submenu of its entries named for their place, each writing the list whole', () => {
    const { src, onChange } = store({ caps: [10, 20] });
    const rows = rowsOf(only(resolveSchemaMenu(menu({ caps }), src)));
    expect(rows.map((r) => (r as { label: string }).label)).toEqual(['Cap 1', 'Cap 2', 'Add Cap', 'Remove Cap']);
    (rows[1] as MenuNumberEntry).set(25);
    expect(onChange).toHaveBeenLastCalledWith('caps', [10, 25]);
  });

  it('removes any entry from a submenu naming each', () => {
    const { src, onChange } = store({ caps: [10, 20, 30] });
    const remove = sub(rowsOf(only(resolveSchemaMenu(menu({ caps }), src))).find((r) => r.key === 'caps/-')!);
    expect(remove.entries.map((r) => (r as MenuItemEntry).label)).toEqual(['Cap 1', 'Cap 2', 'Cap 3']);
    (remove.entries[1] as MenuItemEntry).run();
    expect(onChange).toHaveBeenLastCalledWith('caps', [10, 30]);
  });

  it('adds an entry at its item default and removes one, within its bounds', () => {
    const { src, onChange } = store({ caps: [10, 20] });
    const rows = rowsOf(only(resolveSchemaMenu(menu({ caps: { ...caps, minItems: 2 } }), src)));
    const add = rows.find((r) => r.key === 'caps/+') as MenuItemEntry;
    const remove = sub(rows.find((r) => r.key === 'caps/-')!);
    expect(remove.disabled).toBe(true);
    expect(remove.entries.every((r) => (r as MenuItemEntry).disabled)).toBe(true);
    add.run();
    expect(onChange).toHaveBeenLastCalledWith('caps', [10, 20, 0]);
    const full = rowsOf(only(resolveSchemaMenu(menu({ caps }), store({ caps: [1, 2, 3] }).src)));
    expect(full.find((r) => r.key === 'caps/+')).toMatchObject({ disabled: true });
  });

  it('draws an entry that is an object as a submenu that writes into its entry', () => {
    const strokes = leafOf<PrefList>({ kind: 'list', name: 'Strokes', default: [], item: stroke });
    const { src, onChange } = store({ strokes: [{ width: 1, color: '#000000' }, { width: 2, color: '#111111' }] });
    const second = sub(rowsOf(only(resolveSchemaMenu(menu({ strokes }), src)))[1]!);
    expect(second.label).toBe('Stroke 2');
    (second.entries[0] as MenuNumberEntry).set(9);
    expect(onChange).toHaveBeenLastCalledWith('strokes', [{ width: 1, color: '#000000' }, { width: 9, color: '#111111' }]);
  });
});

describe('resolveSchemaMenu: a map leaf', () => {
  const sizes = leafOf<PrefMap>({ kind: 'map', name: 'Sizes', default: {}, item: pref.number('Size', 0) });

  it('is a submenu of its entries named for their keys, a key holding a dot among them', () => {
    const { src, onChange } = store({ sizes: { small: 8, large: 24, 'a.b': 1, 'c\\d': 2 } });
    const rows = rowsOf(only(resolveSchemaMenu(menu({ sizes }), src))).filter((r) => r.kind === 'number') as MenuNumberEntry[];
    expect(rows.map((r) => [r.label, r.value])).toEqual([['small', 8], ['large', 24], ['a.b', 1], ['c\\d', 2]]);
    rows[1]!.set(30);
    expect(onChange).toHaveBeenLastCalledWith('sizes', { small: 8, large: 30, 'a.b': 1, 'c\\d': 2 });
    rows[2]!.set(5);
    expect(onChange).toHaveBeenLastCalledWith('sizes', { small: 8, large: 30, 'a.b': 5, 'c\\d': 2 });
    rows[3]!.set(6);
    expect(onChange).toHaveBeenLastCalledWith('sizes', { small: 8, large: 30, 'a.b': 5, 'c\\d': 6 });
  });

  it('writes into an entry under a dotted key inside an object', () => {
    const box = leafOf<PrefObject>({ kind: 'object', name: 'Box', default: {}, children: { sizes } });
    const { src, onChange } = store({ box: { sizes: { 'x.y': 1 } } });
    const inner = sub(rowsOf(only(resolveSchemaMenu(menu({ box }), src)))[0]!);
    (inner.entries[0] as MenuNumberEntry).set(4);
    expect(onChange).toHaveBeenLastCalledWith('box', { sizes: { 'x.y': 4 } });
  });

  it('adds an entry under the key typed into its add row, at its item default', () => {
    const { src, onChange } = store({ sizes: { small: 8 } });
    const add = rowsOf(only(resolveSchemaMenu(menu({ sizes }), src))).find((r) => r.key === 'sizes/+') as MenuTextEntry;
    expect(add).toMatchObject({ kind: 'text', label: 'Add Size', value: undefined });
    add.set('');
    add.set('small');
    expect(onChange).not.toHaveBeenCalled();
    add.set('huge.ish');
    expect(onChange).toHaveBeenLastCalledWith('sizes', { small: 8, 'huge.ish': 0 });
  });

  it('removes any entry from a submenu naming each key', () => {
    const { src, onChange } = store({ sizes: { small: 8, 'a.b': 1 } });
    const remove = sub(rowsOf(only(resolveSchemaMenu(menu({ sizes }), src))).find((r) => r.key === 'sizes/-')!);
    expect(remove.entries.map((r) => (r as MenuItemEntry).label)).toEqual(['small', 'a.b']);
    (remove.entries[1] as MenuItemEntry).run();
    expect(onChange).toHaveBeenLastCalledWith('sizes', { small: 8 });
  });

  it('offers no add or remove when it is a readout', () => {
    const { src } = store({ sizes: { small: 8 } });
    const rows = rowsOf(only(resolveSchemaMenu(menu({ sizes: { ...sizes, readout: true } }), src)));
    expect(rows.map((r) => r.key)).toEqual(['sizes.small']);
  });
});

describe('pathSegment', () => {
  it('escapes a dot and a backslash, and pathSegments reads them back', () => {
    const keys = ['a.b', 'c\\d', 'plain', '', 'x\\.y'];
    expect(pathSegments(keys.map(pathSegment).join('.'))).toEqual(keys);
  });
});

describe('resolveSchemaMenu: a union leaf', () => {
  const gradient = leafOf<PrefUnion>({
    kind: 'union', name: 'Gradient', tag: 'type', default: { type: 'linear', angle: 90 },
    variants: {
      linear: leafOf<PrefObject>({ kind: 'object', name: 'Linear', default: { angle: 0 }, children: { angle: pref.number('Angle', 0) } }),
      radial: leafOf<PrefObject>({ kind: 'object', name: 'Radial', default: { radius: 1 }, children: { radius: pref.number('Radius', 1) } }),
    },
  });

  it('is a submenu of its variants, checked for the one held, then that variant’s fields', () => {
    const { src, onChange } = store({ g: { type: 'radial', radius: 4 } });
    const rows = rowsOf(only(resolveSchemaMenu(menu({ g: gradient }), src)));
    expect(rows.map((r) => [(r as { label: string }).label, (r as { checked?: boolean }).checked, (r as { radio?: true }).radio])).toEqual([
      ['Linear', false, true], ['Radial', true, true], ['Radius', undefined, undefined],
    ]);
    (rows[2] as MenuNumberEntry).set(6);
    expect(onChange).toHaveBeenLastCalledWith('g', { type: 'radial', radius: 6 });
    (rows[0] as MenuItemEntry).run();
    expect(onChange).toHaveBeenLastCalledWith('g', { angle: 0, type: 'linear' });
  });
});

describe('resolveSchemaMenu: a field leaf', () => {
  it('is a submenu offering the value-holding leaves of its kinds, checked for the one named', () => {
    const target = leafOf<PrefField>({ kind: 'field', name: 'Follows', default: '', kinds: ['number'] });
    const { src, onChange } = store({ target: 'b' });
    const schema = menu({ a: pref.number('A', 0), b: pref.number('B', 0), c: pref.string('C', ''), target });
    const e = resolveSchemaMenu(schema, src).find((x) => x.key === 'target')!;
    const rows = rowsOf(e) as MenuItemEntry[];
    expect(rows.map((r) => [r.label, r.checked, r.radio])).toEqual([['A', false, true], ['B', true, true]]);
    rows[0]!.run();
    expect(onChange).toHaveBeenLastCalledWith('target', 'a');
  });
});

describe('resolveSchemaMenu: a paint leaf', () => {
  const fill = leafOf<PrefPaint>({ kind: 'paint', name: 'Fill', default: null, alpha: true });

  it('is a color row while solid, writing a solid paint that keeps its other fields', () => {
    const { src, onChange } = store({ fill: { color: '#336699', opacity: 0.5 } });
    const e = only(resolveSchemaMenu(menu({ fill }), src)) as MenuColorEntry;
    expect(e).toMatchObject({ kind: 'color', value: '#336699', alpha: true });
    e.set!('#ff0000');
    expect(onChange).toHaveBeenLastCalledWith('fill', { color: '#ff0000', opacity: 0.5 });
  });

  it('is a color row holding none for no paint, and reads as its kind otherwise', () => {
    expect(only(resolveSchemaMenu(menu({ fill }), store({ fill: null }).src))).toMatchObject({ kind: 'color', value: undefined });
    const other = only(resolveSchemaMenu(menu({ fill }), store({ fill: { kind: 'linear', stops: [] } }).src));
    expect(other).toMatchObject({ kind: 'item', label: 'Fill: linear', disabled: true });
  });
});

describe('resolveSchemaMenu: an app-defined leaf', () => {
  const custom = { kind: 'angle-dial', name: 'Dial', description: '', default: 0 } as PrefLeaf;

  it('is left out without customRows', () => {
    expect(resolveSchemaMenu(menu({ dial: custom }), store({ dial: 3 }).src)).toEqual([]);
  });

  it('is drawn by customRows, which reads and writes where the leaf sits', () => {
    const customRows = vi.fn((_leaf: PrefLeaf, at: { key: string; values(p: string): unknown; onChange?(p: string, v: unknown): void }) => [
      { kind: 'item' as const, key: at.key, label: `Dial ${String(at.values('box.dial'))}`, run: () => at.onChange?.('box.dial', 7) },
    ]);
    const box = leafOf<PrefObject>({ kind: 'object', name: 'Box', default: {}, children: { dial: custom } });
    const { src, onChange } = store({ box: { dial: 3 } }, { customRows });
    const row = rowsOf(only(resolveSchemaMenu(menu({ box }), src)))[0] as MenuItemEntry;
    expect(row).toMatchObject({ key: 'box.dial', label: 'Dial 3' });
    row.run();
    expect(onChange).toHaveBeenLastCalledWith('box', { dial: 7 });
  });
});
