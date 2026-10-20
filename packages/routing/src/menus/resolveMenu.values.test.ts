import { describe, expect, it, vi } from 'vitest';
import type { MenuEntry, MenuNumberEntry, MenuTextEntry } from '@weasel-js/menu';
import { pref, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { percent } from '@weasel-js/quantity';
import { resolveSchemaMenu, type MenuSources } from './resolveMenu';

function valued(initial: Record<string, unknown>, withChange = true): MenuSources & { onChange: ReturnType<typeof vi.fn> } {
  const store = { ...initial };
  const onChange = vi.fn((path: string, value: unknown) => { store[path] = value; });
  return {
    actions: () => [], depsFor: () => undefined, trigger: () => true,
    values: (p) => store[p], ...(withChange ? { onChange } : {}),
  } as MenuSources & { onChange: ReturnType<typeof vi.fn> };
}

const menu = (children: Record<string, PrefLeaf | PrefGroup>): PrefGroup => ({ name: '', children });
const only = (es: MenuEntry[]) => { expect(es).toHaveLength(1); return es[0]!; };

describe('resolveSchemaMenu: number leaves', () => {
  it('draws a number as a row holding its value, bounds, and step, that writes it', () => {
    const src = valued({ zoom: 8 });
    const e = only(resolveSchemaMenu(menu({ zoom: pref.number('Magnification', 4, { min: 2, max: 16, step: 1, access: 'm' }) }), src));
    expect(e).toMatchObject({ kind: 'number', key: 'zoom', label: 'Magnification', value: 8, min: 2, max: 16, step: 1, access: 'm' });
    (e as MenuNumberEntry).set(12);
    expect(src.onChange).toHaveBeenCalledWith('zoom', 12);
  });

  it('bounds a number by the minAt and maxAt it reads from the values beside it', () => {
    const src = valued({ w: 30, floor: 25, ceiling: 40 });
    const leaf = pref.number('Width', 0, { min: 0, max: 100, minAt: (read) => read('floor') as number, maxAt: (read) => read('ceiling') as number });
    const e = only(resolveSchemaMenu(menu({ w: leaf }), src)) as MenuNumberEntry;
    expect(e).toMatchObject({ min: 25, max: 40 });
  });

  it('shows and takes a value in its display unit, and stores it in its own', () => {
    const src = valued({ angle: Math.PI / 2 });
    const leaf = pref.number('Angle', 0, { min: 0, max: Math.PI, step: Math.PI / 180, unit: { suffix: '°', scale: Math.PI / 180 } });
    const e = only(resolveSchemaMenu(menu({ angle: leaf }), src)) as MenuNumberEntry;
    expect(e.value).toBeCloseTo(90);
    expect(e.max).toBeCloseTo(180);
    expect(e.step).toBeCloseTo(1);
    expect(e.suffix).toBe('°');
    e.set(45);
    expect(src.onChange.mock.calls[0]![1]).toBeCloseTo(Math.PI / 4);
  });

  it('has no value where none is stored, and is disabled as a readout or when its condition fails', () => {
    const src = valued({ on: false });
    const es = resolveSchemaMenu(menu({
      on: pref.boolean('On', false),
      a: pref.number('A', 1),
      b: pref.number('B', 1, { readout: true }),
      c: pref.number('C', 1, { enableIf: { path: 'on' } }),
    }), src);
    expect(es.slice(1)).toMatchObject([
      { kind: 'number', value: undefined }, { kind: 'number', disabled: true }, { kind: 'number', disabled: true },
    ]);
    expect(es[1]).not.toHaveProperty('disabled', true);
  });

  it('carries the display its leaf shows the value in', () => {
    const display = percent();
    const e = only(resolveSchemaMenu(menu({ a: pref.number('A', 0.5, { display }) }), valued({ a: 0.5 })));
    expect(e).toMatchObject({ kind: 'number', display });
  });

  it('carries its endless ends and word for infinity, and holds an infinity stored at one', () => {
    const leaf = pref.number('Cap', 10, { min: 0, max: 100, endless: 'max', infinity: 'uncapped' });
    const e = only(resolveSchemaMenu(menu({ cap: leaf }), valued({ cap: Infinity }))) as MenuNumberEntry;
    expect(e).toMatchObject({ value: Infinity, endless: 'max', infinity: 'uncapped' });
    expect(only(resolveSchemaMenu(menu({ cap: pref.number('Cap', 10, { max: 100 }) }), valued({ cap: Infinity }))))
      .toMatchObject({ value: undefined });
  });

  it('carries the units its field reads typed, its own suffix among them', () => {
    const leaf = pref.number('Width', 10, { unit: { suffix: 'cm', scale: 10, accepts: { mm: 0.1 } } });
    const e = only(resolveSchemaMenu(menu({ w: leaf }), valued({ w: 10 }))) as MenuNumberEntry;
    expect(e.accepts).toEqual({ cm: 1, mm: 0.1 });
  });

  it('is left out without onChange, as a boolean is', () => {
    expect(resolveSchemaMenu(menu({ a: pref.number('A', 1) }), valued({ a: 1 }, false))).toEqual([]);
  });
});

describe('resolveSchemaMenu: color and string leaves', () => {
  it('draws a color as a row showing it, readout or not', () => {
    const es = resolveSchemaMenu(menu({
      picked: pref.color('Color', '', { readout: true }),
      fill: pref.color('Fill', '#000000'),
    }), valued({ picked: '#336699' }, false));
    expect(es).toEqual([
      { kind: 'color', key: 'picked', label: 'Color', value: '#336699' },
      { kind: 'color', key: 'fill', label: 'Fill', value: undefined },
    ]);
  });

  it('draws a string as a text row holding its value, that writes it', () => {
    const src = valued({ name: 'Layer 1' });
    const e = only(resolveSchemaMenu(menu({ name: pref.string('Name', '', { access: 'n' }) }), src));
    expect(e).toMatchObject({ kind: 'text', key: 'name', label: 'Name', value: 'Layer 1', access: 'n' });
    expect(e).not.toHaveProperty('disabled');
    (e as MenuTextEntry).set('Layer 2');
    expect(src.onChange).toHaveBeenCalledWith('name', 'Layer 2');
  });

  it('draws a string read-only, as its name and value, when it is a readout or nothing writes it', () => {
    const readOnly = only(resolveSchemaMenu(menu({ name: pref.string('Name', '') }), valued({ name: 'Layer 1' }, false)));
    expect(readOnly).toMatchObject({ kind: 'item', label: 'Name: Layer 1', disabled: true });
    const readout = only(resolveSchemaMenu(menu({ name: pref.string('Name', '', { readout: true }) }), valued({ name: 'Layer 1' })));
    expect(readout).toMatchObject({ kind: 'item', label: 'Name: Layer 1', disabled: true });
  });

  it('disables a text row whose enableIf fails', () => {
    const schema = menu({ name: pref.string('Name', '', { enableIf: { path: 'on' } }) });
    const e = resolveSchemaMenu(schema, valued({ name: 'x', on: false })).find((x) => x.kind === 'text');
    expect(e).toMatchObject({ kind: 'text', disabled: true });
  });
});
