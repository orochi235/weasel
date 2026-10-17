import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryAdapter } from '@weasel-js/labkit';
import type { PrefGroup } from '@weasel-js/prefs';
import { pref } from '@weasel-js/prefs';
import { afterEach, describe, expect, it } from 'vitest';
import type { ShellConfig } from '../config';
import type { IndexEntry } from '../story/types';
import { type GlobalDeclarations } from './globals';
import { globalsMenu } from './globalsMenu';
import { installResizeObserver } from './labHarness';
import { Workshop } from './Workshop';

installResizeObserver();

const a: IndexEntry = { id: 'x--a', title: 'X', name: 'A', exportName: 'A', file: '/x.stories.tsx' };
const options = [
  { value: 'auto', label: 'Auto (OS)' },
  { value: 'dark', label: 'Dark' },
];
const config = (extra: Partial<GlobalDeclarations['theme']> = {}): ShellConfig => ({
  globals: { theme: { label: 'Theme', default: 'auto', options, ...extra } },
});

afterEach(() => {
  history.replaceState(null, '', '/');
});

const mount = (shell: ShellConfig) =>
  render(<Workshop index={[a]} frameUrl="/frame.html" config={shell} storage={createMemoryAdapter()} />);

const title = async (name: string) =>
  (await screen.findAllByRole('menuitem', { name })).find(
    (el) => el.parentElement?.getAttribute('role') === 'menubar',
  ) as HTMLElement;
const open = async (name: string) => {
  const el = await title(name);
  await act(async () => {
    fireEvent.pointerDown(el);
  });
};
const press = async (el: HTMLElement) => {
  await act(async () => {
    fireEvent.click(el);
  });
};

describe('globalsMenu', () => {
  it('builds a Globals menu with a submenu per declaration and App first where it follows', () => {
    const bar = globalsMenu({
      theme: { label: 'Theme', default: 'app', options, follows: () => 'dark' },
      font: { label: 'Font', default: 'a', options: [{ value: 'a', label: 'A' }] },
    }) as PrefGroup;
    const globals = bar.children.globals as PrefGroup;
    expect(globals).toMatchObject({ name: 'Globals', as: 'menu' });
    const theme = globals.children.d0 as PrefGroup;
    expect(theme).toMatchObject({ name: 'Theme', as: 'menu' });
    expect(Object.values(theme.children)).toEqual([
      pref.action('fg.global.theme.app'),
      pref.action('fg.global.theme.auto'),
      pref.action('fg.global.theme.dark'),
    ]);
    expect((globals.children.d1 as PrefGroup).children).toEqual({
      o0: pref.action('fg.global.font.a'),
    });
  });

  it('adds no Globals menu when no globals are declared', async () => {
    expect(globalsMenu({})).toBeUndefined();
    mount({});
    await screen.findByRole('menubar', { name: 'Lab menu bar' });
    expect(screen.queryByRole('menuitem', { name: 'Globals' })).toBeNull();
  });

  it('sets a global from its menu row and checks the current value', async () => {
    mount(config());
    await open('Globals');
    await press(await screen.findByRole('menuitem', { name: 'Theme' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Auto (OS)' })).toHaveAttribute('aria-checked', 'true');
    await press(screen.getByRole('menuitemcheckbox', { name: 'Dark' }));
    const toolbar = within(await screen.findByRole('toolbar', { name: 'Globals' }));
    await waitFor(() => expect(toolbar.getByRole('button', { name: /Theme/ })).toHaveTextContent('Dark'));
    await open('Globals');
    await press(await screen.findByRole('menuitem', { name: 'Theme' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  });

  it("disables an option its declaration's shows leaves out", async () => {
    mount(config({ shows: (value) => value !== 'dark' }));
    await open('Globals');
    await press(await screen.findByRole('menuitem', { name: 'Theme' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Dark' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Auto (OS)' })).not.toHaveAttribute('aria-disabled', 'true');
  });
});
