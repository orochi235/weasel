import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { AssetList } from './AssetList';
import type { Asset } from './workspace';

afterEach(cleanup);

const root: PrefGroup = { name: '', children: {} };
const ASSETS: Asset[] = [
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

it('marks an asset another editor holds where the host says it changed', () => {
  render(<AssetList assets={ASSETS} selected="a" changed={new Set()} onSelect={() => {}}
    elsewhere={[{ id: 'r', label: 'Reader', under: 'Dialogs', changed: true }, { id: 's', label: 'Shell', under: 'Dialogs' }]} />);
  expect(marked('Reader')).toBe(true);
  expect(marked('Shell')).toBe(false);
});
