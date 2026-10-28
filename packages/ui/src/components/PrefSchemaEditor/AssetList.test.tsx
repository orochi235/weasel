import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

const names = () => screen.getAllByRole('option').map((o) => o.firstElementChild?.textContent);

it('sorts each heading\'s assets by name, another editor\'s among this one\'s', () => {
  const assets: ShownAsset[] = [{ id: 'z', label: 'Zoom', kind: 'schema', root }, { id: 'a', label: 'app', kind: 'schema', root }];
  render(<AssetList assets={assets} selected="a" changed={new Set()} onSelect={() => {}}
    elsewhere={[{ id: 'r', label: 'Reader', under: 'Dialogs' }, { id: 'b', label: 'Board 10', under: 'Dialogs' }, { id: 'c', label: 'Board 9', under: 'Dialogs' }]} />);
  expect(names()).toEqual(['app', 'Board 9', 'Board 10', 'Reader', 'Zoom']);
});

it('keeps the order a host gives over the sort', () => {
  render(<AssetList assets={ASSETS} order={['b', 'a']} selected="a" changed={new Set()} onSelect={() => {}} />);
  expect(names()).toEqual(['Board', 'App', 'Panel']);
});

it('folds a heading\'s assets away, and unfolds it when the one shown moves under it', () => {
  const { rerender } = render(list('p', []));
  const dialogs = screen.getByRole('button', { name: 'Dialogs' });
  fireEvent.click(dialogs);
  expect(dialogs.getAttribute('aria-expanded')).toBe('false');
  expect(names()).toEqual(['Panel']);
  rerender(list('b', []));
  expect(names()).toEqual(['App', 'Board', 'Panel']);
});

it('badges each asset with its heading\'s kind, outside the name a row is found by', () => {
  render(list('a', []));
  expect(screen.getByRole('option', { name: 'Board' }).textContent).toContain('dialog');
  expect(screen.getByRole('option', { name: 'Panel' }).textContent).toContain('panel');
});
