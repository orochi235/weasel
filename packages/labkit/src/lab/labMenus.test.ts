import { type PrefGroup, pref } from '@weasel-js/prefs';
import { AddIcon } from '@weasel-js/ui';
import { describe, expect, it } from 'vitest';
import type { LabContribution } from '../chrome/labTypes';
import type { InstrumentList } from '../instrument/types';
import { labMenuBar } from './labMenus';

const make = (name: string, title?: string) => ({
  name,
  ...(title ? { title } : {}),
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
});
const ONE: InstrumentList = [make('Stub')];
const TWO: InstrumentList = [make('a.b', 'Dotted'), make('Plain')];
const item = (label: string) => ({ icon: AddIcon, label, onActivate: () => {} });

const base = { instruments: ONE, addTrial: true, zoom: true, header: [] as LabContribution[] };
const menu = (bar: PrefGroup, key: string) => bar.children[key] as PrefGroup;

describe('labMenuBar', () => {
  it('puts Lab first and View last, with declared menus between', () => {
    const declared = pref.group('', {
      tools: pref.group('Tools', { x: pref.action('x') }, { as: 'menu' }),
    });
    const bar = labMenuBar({ ...base, declared });
    expect(Object.keys(bar.children)).toEqual(['lab', 'tools', 'view']);
    expect(menu(bar, 'lab')).toMatchObject({ name: 'Lab', as: 'menu' });
    expect(menu(bar, 'view')).toMatchObject({ name: 'View', as: 'menu' });
  });

  it('offers one add row for one instrument and a submenu for several', () => {
    expect(menu(labMenuBar(base), 'lab').children.add).toEqual(pref.action('lab.add.Stub'));
    const add = menu(labMenuBar({ ...base, instruments: TWO }), 'lab').children.add as PrefGroup;
    expect(add).toMatchObject({ name: 'Add trial', as: 'menu' });
    expect(add.children).toEqual({
      t0: pref.action('lab.add.a.b'),
      t1: pref.action('lab.add.Plain'),
    });
  });

  it('leaves out add rows with addTrial false and the zoom section with zoom false', () => {
    const bar = labMenuBar({ ...base, addTrial: false, zoom: false });
    expect(menu(bar, 'lab').children.add).toBeUndefined();
    expect(Object.keys(menu(bar, 'view').children)).toEqual(['theme']);
    const full = labMenuBar(base);
    expect(Object.keys(menu(full, 'view').children)).toEqual(['zoom', 'theme']);
    expect((menu(full, 'view').children.zoom as PrefGroup).children).toEqual({
      zoom: pref.action('lab.zoom'),
    });
    expect((menu(full, 'view').children.theme as PrefGroup).children).toEqual({
      auto: pref.action('lab.mode.auto'),
      light: pref.action('lab.mode.light'),
      dark: pref.action('lab.mode.dark'),
    });
  });

  it('lists header item contributions by group, and no render contribution', () => {
    const header: LabContribution[] = [
      { id: 'loose', region: 'header', item: item('Loose') },
      { id: 'a1', region: 'header', group: 'a', item: item('A1') },
      { id: 'b1', region: 'header', group: 'b', item: item('B1') },
      { id: 'drawn', region: 'header', render: () => null },
      { id: 'a2', region: 'header', group: 'a', item: item('A2') },
      { id: 'side', region: 'sidebar', item: { title: 'Side', body: null } },
    ];
    const lab = menu(labMenuBar({ ...base, header }), 'lab');
    const sections = Object.entries(lab.children)
      .filter(([key]) => key !== 'add')
      .map(([, node]) => (node as PrefGroup).children);
    expect(sections).toEqual([
      { 'c-a1': pref.action('lab.item.a1'), 'c-a2': pref.action('lab.item.a2') },
      { 'c-b1': pref.action('lab.item.b1') },
      { 'c-loose': pref.action('lab.item.loose') },
    ]);
  });

  it("appends a declared 'view' menu's children to the built-in View after a separator", () => {
    const declared = pref.group('', {
      view: pref.group(
        'Mine',
        { grid: pref.boolean('Grid', true), theme: pref.action('t') },
        { as: 'menu' },
      ),
    });
    const bar = labMenuBar({ ...base, declared });
    expect(Object.keys(bar.children)).toEqual(['lab', 'view']);
    const view = menu(bar, 'view');
    expect(view.name).toBe('View');
    expect(Object.keys(view.children)).toEqual(['zoom', 'theme', '~sep1', 'grid', 'theme~1']);
    expect(view.children['~sep1']).toMatchObject({ kind: 'separator' });
  });
});
