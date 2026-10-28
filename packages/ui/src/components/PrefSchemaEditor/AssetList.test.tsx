import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { AssetList } from './AssetList';
import type { ShownAsset } from './workspace';

afterEach(cleanup);

const root: PrefGroup = { name: '', children: {} };
const ASSETS: ShownAsset[] = [
  { id: 'a', label: 'App', kind: 'schema', root },
  { id: 'b', label: 'Board', kind: 'schema', root },
  { id: 'p', label: 'Panel', kind: 'layout', root, over: 'a' },
];

const list = (selected: string, changed: string[]) => (
  <AssetList assets={ASSETS} selected={selected} changed={new Set(changed)} onSelect={() => {}} />
);
const marked = (label: string) => screen.getByRole('option', { name: label }).hasAttribute('data-changed');

it('marks an asset that came to differ while another under its heading is the one shown', () => {
  const { rerender } = render(list('a', []));
  expect(marked('Board')).toBe(false);
  rerender(list('a', ['b']));
  expect(marked('Board')).toBe(true);
  rerender(list('b', ['a', 'b']));
  expect(marked('App')).toBe(true);
  rerender(list('b', ['b']));
  expect(marked('App')).toBe(false);
});

it('lists a menu asset under Menus, after Toolbars', () => {
  const bar: PrefGroup = { name: '', as: 'bar', children: {} };
  const menu: PrefGroup = { name: 'Edit', as: 'menu', children: {} };
  const assets: ShownAsset[] = [
    ...ASSETS,
    { id: 't', label: 'Tools', kind: 'layout', root: bar, over: 'a' },
    { id: 'm', label: 'Edit menu', kind: 'layout', root: menu, over: 'a' },
  ];
  render(<AssetList assets={assets} selected="a" changed={new Set()} onSelect={() => {}} />);
  const titles = ['Dialogs', 'Panels', 'Toolbars', 'Menus'];
  const order = screen.getAllByRole('group').map((g) => titles.find((t) => g.textContent?.startsWith(t)));
  expect(order).toEqual(titles);
  expect(screen.getByRole('option', { name: 'Edit menu' }).closest('[role="group"]')?.textContent).toContain('Menus');
});

it('lists a node kind\'s properties under their own heading, after Dialogs', () => {
  const assets: ShownAsset[] = [...ASSETS, { id: 'n', label: 'rect', kind: 'schema', nodeKind: 'rect', root }];
  render(<AssetList assets={assets} selected="a" changed={new Set()} onSelect={() => {}} />);
  const headings = screen.getAllByRole('group').map((g) => g.querySelector('header')?.textContent);
  expect(headings).toEqual(['Dialogs', 'Node properties', 'Panels']);
  expect(screen.getByRole('option', { name: 'rect' }).closest('[role="group"]')?.textContent).toContain('Node properties');
});

it('marks an asset another editor holds where the host says it changed', () => {
  render(<AssetList assets={ASSETS} selected="a" changed={new Set()} onSelect={() => {}}
    elsewhere={[{ id: 'r', label: 'Reader', under: 'Dialogs', changed: true }, { id: 's', label: 'Shell', under: 'Dialogs' }]} />);
  expect(marked('Reader')).toBe(true);
  expect(marked('Shell')).toBe(false);
});
