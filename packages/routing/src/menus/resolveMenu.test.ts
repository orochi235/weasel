import { describe, expect, it, vi } from 'vitest';
import type { MenuEntry } from '@weasel-js/menu';
import { pref, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { resolveMenu, resolveSchemaMenu, type MenuSources } from './resolveMenu';
import { toIconRef } from '@weasel-js/icons';
import { ActionDisabledReason, type Action } from '../interactions/actions/action';

const immediate = { timing: 'immediate' as const, run: () => {} };
const actions: Action[] = [
  { id: 'cut', label: 'Cut', invoker: immediate, defaultBinding: { kind: 'key', key: 'x', mods: { meta: true } } },
  { id: 'paste', label: 'Paste', invoker: immediate,
    enabled: (_d, at) => (at ? true : ActionDisabledReason.NotApplicable) },
  { id: 'snap', label: 'Snap', invoker: immediate, active: () => true },
  { id: 'align', label: 'Align', group: 'arrange', invoker: immediate, variants: [
    { key: 'l', label: 'Left', params: { edge: 'left' } },
    { key: 'r', label: 'Right', params: { edge: 'right' } },
  ] },
  { id: 'flip', label: 'Flip', icon: toIconRef('test:flip')!, invoker: immediate, variants: [
    { key: 'h', label: 'Horizontal', icon: toIconRef('test:flipH')!, params: { axis: 'x' } },
    { key: 'v', label: 'Vertical', params: { axis: 'y' } },
  ] },
  { id: 'front', label: 'To Front', group: 'arrange', invoker: immediate },
  { id: 'drag', label: 'Drag', group: 'arrange', invoker: { timing: 'ongoing', start: () => ({}) as never } },
];

type Src = MenuSources & { trigger: ReturnType<typeof vi.fn> };
function sources(extra: Partial<MenuSources> = {}): Src {
  return { actions: () => actions, depsFor: () => undefined, trigger: vi.fn(() => true), ...extra } as Src;
}

function valued(initial: Record<string, unknown>): Src & { onChange: ReturnType<typeof vi.fn> } {
  const store = { ...initial };
  const onChange = vi.fn((path: string, value: unknown) => { store[path] = value; });
  return Object.assign(sources({ values: (p) => store[p] }), { onChange });
}

const menu = (children: Record<string, PrefLeaf | PrefGroup>): PrefGroup => ({ name: '', children });
const act = (id: string) => pref.action(id);
const labels = (es: MenuEntry[]) => es.map((e) => (e.kind === 'separator' ? '---' : e.label));
const run = (e: MenuEntry | undefined) => (e as { run(): void }).run();

describe('resolveSchemaMenu: action leaves', () => {
  it('reads label, shortcut, and checked from the registry', () => {
    const es = resolveSchemaMenu(menu({ cut: act('cut'), snap: act('snap') }), sources());
    expect(es[0]).toMatchObject({ kind: 'item', label: 'Cut', shortcut: expect.objectContaining({ key: 'x' }) });
    expect(es[1]).toMatchObject({ checked: true });
  });
  it('shows the leaf label or name over the action label', () => {
    const es = resolveSchemaMenu(menu({
      a: pref.action('cut', { name: 'Snip' }), b: pref.action('cut', { label: 'Clip', name: 'Snip' }),
    }), sources());
    expect(labels(es)).toEqual(['Snip', 'Clip']);
  });
  it('drops unregistered and non-immediate actions', () => {
    expect(labels(resolveSchemaMenu(menu({ a: act('nope'), b: act('drag'), c: act('cut') }), sources()))).toEqual(['Cut']);
  });
  it('asks enabled with the point', () => {
    const s = menu({ p: act('paste') });
    expect(resolveSchemaMenu(s, sources(), { x: 1, y: 2 })[0]).toMatchObject({ disabled: false });
    expect(resolveSchemaMenu(s, sources())[0]).toMatchObject({ disabled: true });
  });
  it('runs through trigger with the menu params and the point, the point winning', () => {
    const src = sources();
    run(resolveSchemaMenu(menu({ cut: act('cut') }), src, { x: 3, y: 4 }, { nodeId: 'n1', world: { x: 99, y: 99 } })[0]);
    expect(src.trigger).toHaveBeenCalledWith('cut', { nodeId: 'n1', world: { x: 3, y: 4 } });
  });
  it('sends no point when opened without one', () => {
    const src = sources();
    run(resolveSchemaMenu(menu({ cut: act('cut') }), src)[0]);
    expect(src.trigger).toHaveBeenCalledWith('cut', {});
  });
  it('expands a parametric action into one row per variant, each with its own icon and params', () => {
    const src = sources();
    const es = resolveSchemaMenu(menu({ flip: act('flip') }), src);
    expect(labels(es)).toEqual(['Horizontal', 'Vertical']);
    expect(es.map((e) => e.kind === 'item' && e.icon)).toEqual(['test:flipH', 'test:flip']);
    run(es[1]);
    expect(src.trigger).toHaveBeenCalledWith('flip', { axis: 'y' });
  });
  it('resolves an id:variant leaf to that variant alone', () => {
    const src = sources();
    const es = resolveSchemaMenu(menu({ r: act('align:r'), named: pref.action('align:l', { name: 'Flush left' }) }), src);
    expect(labels(es)).toEqual(['Right', 'Flush left']);
    run(es[0]);
    expect(src.trigger).toHaveBeenCalledWith('align', { edge: 'right' });
  });
  it('draws a leaf naming no action as a dead row, never calling its run', () => {
    const fn = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const es = resolveSchemaMenu(menu({ go: { kind: 'action', name: 'Go', description: '', default: undefined, run: fn } }), sources());
    expect(es[0]).toMatchObject({ kind: 'item', label: 'Go', disabled: true });
    run(es[0]);
    expect(fn).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it('gives the same action listed twice distinct keys', () => {
    const keys = resolveSchemaMenu(menu({ a: act('align'), b: act('align'), c: act('cut') }), sources()).map((e) => e.key);
    expect(keys).toHaveLength(5);
    expect(new Set(keys).size).toBe(5);
  });
});

describe('resolveSchemaMenu: actions leaves', () => {
  it('lists every immediate action in the group, in registry order, variants expanded', () => {
    expect(labels(resolveSchemaMenu(menu({ arr: pref.actions('arrange') }), sources()))).toEqual(['Left', 'Right', 'To Front']);
  });
});

describe('resolveSchemaMenu: values', () => {
  const grid = pref.boolean('Grid', false);
  const mode = pref.enum('Mode', 'a', [{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }, 'c']);
  const view = (leaf: PrefLeaf) => menu({ cut: act('cut'), view: pref.group('', { leaf }) });

  it('leaves booleans and enums out without values and onChange', () => {
    expect(labels(resolveSchemaMenu(view(grid), sources()))).toEqual(['Cut']);
    expect(labels(resolveSchemaMenu(view(mode), sources({ values: () => 'a' })))).toEqual(['Cut']);
  });
  it('draws a boolean as a checked item that toggles it', () => {
    const src = valued({ 'view.leaf': true });
    const es = resolveSchemaMenu(view(grid), src);
    expect(es[2]).toMatchObject({ kind: 'item', label: 'Grid', checked: true, disabled: false });
    run(es[2]);
    expect(src.onChange).toHaveBeenCalledWith('view.leaf', false);
  });
  it('draws an enum as rows with the current one checked, set on choose', () => {
    const src = valued({ 'view.leaf': 'c' });
    const es = resolveSchemaMenu(view(mode), src);
    expect(labels(es)).toEqual(['Cut', '---', 'A', 'B', 'C']);
    expect(es.slice(2).map((e) => e.kind === 'item' && [e.checked, e.disabled, e.radio])).toEqual([[false, false, true], [false, true, true], [true, false, true]]);
    run(es[2]);
    expect(src.onChange).toHaveBeenCalledWith('view.leaf', 'a');
  });
  it('goes through a boolean encoding', () => {
    const italic = pref.boolean('Italic', false, {
      encoding: { read: (v) => v === 'italic', write: (on) => (on ? 'italic' : undefined) },
    });
    const src = valued({ 'view.leaf': 'italic' });
    const es = resolveSchemaMenu(view(italic), src);
    expect(es[2]).toMatchObject({ checked: true });
    run(es[2]);
    expect(src.onChange).toHaveBeenCalledWith('view.leaf', undefined);
  });
  it('draws a readout as one disabled row showing its state', () => {
    const src = valued({ 'view.leaf': 'c', 'b.leaf': true });
    const es = resolveSchemaMenu(menu({
      view: pref.group('', { leaf: { ...mode, readout: true } }),
      b: pref.group('', { leaf: { ...grid, readout: true } }),
    }), src);
    expect(es.filter((e) => e.kind === 'item').map((e) => e.kind === 'item' && [e.label, e.disabled, e.checked]))
      .toEqual([['Mode: C', true, undefined], ['Grid', true, true]]);
    run(es[0]);
    expect(src.onChange).not.toHaveBeenCalled();
  });
});

describe('resolveSchemaMenu: groups', () => {
  it('opens a group drawn as a menu, page, tab, or panel as a submenu named for it', () => {
    const es = resolveSchemaMenu(menu({
      m: pref.group('M', { cut: act('cut') }, { as: 'menu' }),
      p: pref.group('P', { cut: act('cut') }, { as: 'page' }),
      t: pref.group('T', { cut: act('cut') }, { as: 'tab' }),
      b: pref.group('B', { cut: act('cut') }, { as: 'panel' }),
    }), sources());
    expect(es.map((e) => [e.kind, e.kind === 'separator' ? '' : e.label])).toEqual([
      ['submenu', 'M'], ['submenu', 'P'], ['submenu', 'T'], ['submenu', 'B'],
    ]);
  });
  it('gives a submenu the icon its group names', () => {
    const glyph = toIconRef('test:more')!;
    const es = resolveSchemaMenu(menu({ m: pref.group('M', { cut: act('cut') }, { as: 'menu', icon: glyph }) }), sources());
    expect(es[0]).toMatchObject({ kind: 'submenu', icon: glyph });
  });
  it('drops a submenu left empty', () => {
    expect(resolveSchemaMenu(menu({ m: pref.group('M', { a: act('nope') }, { as: 'menu' }) }), sources())).toEqual([]);
  });
  it('sets a section, fragment, or unset group inline between separators, collapsing doubles and ends', () => {
    const es = resolveSchemaMenu(menu({
      a: pref.group('', { cut: act('cut') }),
      gone: pref.group('', { x: act('nope') }),
      b: pref.group('S', { snap: act('snap') }, { as: 'section' }),
      c: pref.group('', { f: pref.group('', { front: act('front') }, { as: 'fragment' }) }, { as: 'fragment' }),
      s: pref.separator(),
    }), sources());
    expect(labels(es)).toEqual(['Cut', '---', 'Snap', '---', 'To Front']);
    expect(new Set(es.map((e) => e.key)).size).toBe(es.length);
  });
  it('keeps a value leaf path through nested groups', () => {
    const src = valued({ 'a.b.on': true });
    const es = resolveSchemaMenu(menu({
      a: pref.group('', { b: pref.group('B', { on: pref.boolean('On', false) }, { as: 'menu' }) }),
    }), src);
    expect(es[0]).toMatchObject({ kind: 'submenu', entries: [{ label: 'On', checked: true }] });
  });
});

describe('resolveSchemaMenu: other leaves', () => {
  it('draws a separator leaf as a separator and a label leaf as a disabled item', () => {
    const es = resolveSchemaMenu(menu({ note: pref.label('Arrange'), cut: act('cut'), s: pref.separator(), snap: act('snap') }), sources());
    expect(labels(es)).toEqual(['Arrange', 'Cut', '---', 'Snap']);
    expect(es[0]).toMatchObject({ kind: 'item', disabled: true });
  });
  it('draws an alias as the leaf it points at, in `over` or else the menu schema', () => {
    const over = pref.group('', { view: pref.group('', { grid: pref.boolean('Grid', false) }) });
    const alias = { kind: 'alias', name: '', description: '', default: undefined, of: 'view.grid' } as const;
    const src = Object.assign(valued({ 'view.grid': true }), { over });
    const es = resolveSchemaMenu(menu({ g: alias }), src);
    expect(es[0]).toMatchObject({ key: 'g', label: 'Grid', checked: true });
    run(es[0]);
    expect(src.onChange).toHaveBeenCalledWith('view.grid', false);
    const own = resolveSchemaMenu(menu({ g: alias, view: pref.group('V', { grid: pref.boolean('Grid', false) }, { as: 'menu' }) }), valued({ 'view.grid': true }));
    expect(own[0]).toMatchObject({ label: 'Grid', checked: true });
  });
  it('leaves out a field with no leaf to name, and an app-defined leaf without customRows', () => {
    const es = resolveSchemaMenu(menu({
      f: { kind: 'field', name: 'F', description: '', default: '', kinds: ['color'] }, x: { kind: 'mine', name: 'X', description: '', default: 0 }, cut: act('cut'),
    }), valued({}));
    expect(labels(es)).toEqual(['Cut']);
  });
});

describe('resolveSchemaMenu: conditions', () => {
  it('hides a node whose showIf fails and disables one whose enableIf fails', () => {
    const src = valued({ on: false });
    const es = resolveSchemaMenu(menu({
      hide: pref.action('cut', { showIf: { path: 'on', is: true } }),
      off: pref.group('', { snap: act('snap') }, { enableIf: { path: 'on', is: true } }),
    }), src);
    expect(labels(es)).toEqual(['Snap']);
    expect(es[0]).toMatchObject({ disabled: true });
  });
  it('ignores conditions without values', () => {
    const es = resolveSchemaMenu(menu({ cut: pref.action('cut', { showIf: { path: 'on', is: true } }) }), sources());
    expect(labels(es)).toEqual(['Cut']);
  });
});

describe('resolveMenu', () => {
  it('resolves the def schema', () => {
    expect(labels(resolveMenu({ id: 'm', menu: menu({ cut: act('cut') }) }, sources()))).toEqual(['Cut']);
  });
});

describe('resolveSchemaMenu: access letters', () => {
  it('copies a leaf letter onto the one item it makes', () => {
    const es = resolveSchemaMenu(menu({ cut: pref.action('cut', { access: 't' }) }), sources());
    expect(es[0]).toMatchObject({ kind: 'item', access: 't' });
  });
  it('leaves the letter off every variant a parametric action makes', () => {
    const es = resolveSchemaMenu(menu({ flip: pref.action('flip', { access: 'f' }) }), sources());
    expect(es).toHaveLength(2);
    for (const e of es) expect(e).not.toHaveProperty('access');
  });
  it('keeps a boolean leaf letter', () => {
    const es = resolveSchemaMenu(menu({ grid: pref.boolean('Grid', false, { access: 'g' }) }), valued({ grid: false }));
    expect(es[0]).toMatchObject({ kind: 'item', access: 'g' });
  });
  it('gives a boolean no letter it did not declare', () => {
    const es = resolveSchemaMenu(menu({ grid: pref.boolean('Grid', false) }), valued({ grid: false }));
    expect(es[0]).not.toHaveProperty('access');
  });
  it('copies a letter on a menu group onto its submenu', () => {
    const es = resolveSchemaMenu(menu({
      view: { name: 'View', as: 'menu', access: 'v', children: { cut: act('cut') } },
    }), sources());
    expect(es[0]).toMatchObject({ kind: 'submenu', access: 'v' });
  });
});

describe('resolveSchemaMenu: access letters through aliases and absence', () => {
  const over = pref.group('', { view: pref.group('', {
    grid: pref.boolean('Grid', false, { access: 'g' }), snap: pref.boolean('Snap', false),
  }) });
  const aliasOf = (of: string, access?: string) =>
    ({ kind: 'alias', name: '', description: '', default: undefined, of, ...(access ? { access } : {}) }) as const;
  const aliased = (a: ReturnType<typeof aliasOf>) =>
    resolveSchemaMenu(menu({ a }), Object.assign(valued({ 'view.grid': true, 'view.snap': true }), { over }));

  it('lets an alias letter win over its target letter', () => {
    expect(aliased(aliasOf('view.grid', 'a'))[0]).toMatchObject({ access: 'a' });
  });
  it('lets an alias with no letter inherit its target letter', () => {
    expect(aliased(aliasOf('view.grid'))[0]).toMatchObject({ access: 'g' });
  });
  it('gives an alias of a target with no letter none', () => {
    expect(aliased(aliasOf('view.snap'))[0]).not.toHaveProperty('access');
  });
  it('gives an action leaf with no letter an item with no access key', () => {
    expect(resolveSchemaMenu(menu({ cut: act('cut') }), sources())[0]).not.toHaveProperty('access');
  });
  it('gives a menu group with no letter a submenu with no access key', () => {
    const es = resolveSchemaMenu(menu({ v: pref.group('V', { cut: act('cut') }, { as: 'menu' }) }), sources());
    expect(es[0]).toMatchObject({ kind: 'submenu' });
    expect(es[0]).not.toHaveProperty('access');
  });
});
