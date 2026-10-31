import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createMemoryAdapter } from '@weasel-js/labkit';
import type { PrefEnum, PrefGroup } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShellConfig } from '../config';
import type { IndexEntry } from '../story/types';
import { type GlobalDeclarations } from './globals';
import { globalsMenu } from './globalsMenu';
import { installResizeObserver } from './labHarness';
import { Workshop } from './Workshop';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

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
  renderWithIcons(<Workshop index={[a]} frameUrl="/frame.html" config={shell} storage={createMemoryAdapter()} />);

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

const submenu = (menus: ReturnType<typeof globalsMenu>, n: number) =>
  ((menus?.schema.children.globals as PrefGroup).children[`d${n}`] as PrefGroup);

describe('globalsMenu', () => {
  it('builds a Globals menu with a submenu per declaration holding one enum, App first where it follows', () => {
    const set = vi.fn();
    const menus = globalsMenu(
      {
        theme: { label: 'Theme', default: 'app', options, follows: () => 'dark' },
        font: { label: 'Font', default: 'a', options: [{ value: 'a', label: 'A' }] },
      },
      { theme: 'app', font: 'a' },
      set,
    );
    expect(menus?.schema.children.globals).toMatchObject({ name: 'Globals', as: 'menu' });
    expect(submenu(menus, 0)).toMatchObject({ name: 'Theme', as: 'menu' });
    const theme = submenu(menus, 0).children.v as PrefEnum;
    expect(theme.options.map((o) => o.value)).toEqual(['app', 'auto', 'dark']);
    expect(menus?.values).toEqual({ 'globals.d0.v': 'app', 'globals.d1.v': 'a' });
    menus?.onChange?.('globals.d1.v', 'b');
    expect(set).toHaveBeenCalledWith('font', 'b');
  });

  it('leaves out an option the declaration hides at the current values, as the header does', () => {
    const declarations = { theme: { label: 'Theme', default: 'auto', options, shows: (v: string) => v !== 'dark' } };
    const menus = globalsMenu(declarations, { theme: 'auto' }, vi.fn());
    expect((submenu(menus, 0).children.v as PrefEnum).options.map((o) => o.value)).toEqual(['auto']);
  });

  it('adds no Globals menu when no globals are declared', async () => {
    expect(globalsMenu({}, {}, vi.fn())).toBeUndefined();
    mount({});
    await screen.findByRole('menubar', { name: 'Lab menu bar' });
    expect(screen.queryByRole('menuitem', { name: 'Globals' })).toBeNull();
  });

  it('sets a global from its menu row and checks the current value', async () => {
    mount(config());
    await open('Globals');
    await press(await screen.findByRole('menuitem', { name: 'Theme' }));
    expect(screen.getByRole('menuitemradio', { name: 'Auto (OS)' })).toHaveAttribute('aria-checked', 'true');
    await press(screen.getByRole('menuitemradio', { name: 'Dark' }));
    const toolbar = within(await screen.findByRole('toolbar', { name: 'Globals' }));
    await waitFor(() => expect(toolbar.getByRole('button', { name: /Theme/ })).toHaveTextContent('Dark'));
    await open('Globals');
    await press(await screen.findByRole('menuitem', { name: 'Theme' }));
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  });

  it("leaves out an option its declaration's shows hides", async () => {
    mount(config({ shows: (value) => value !== 'dark' }));
    await open('Globals');
    await press(await screen.findByRole('menuitem', { name: 'Theme' }));
    expect(screen.getByRole('menuitemradio', { name: 'Auto (OS)' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: 'Dark' })).toBeNull();
  });

  it('keeps the active global selected as another global changes what shows', async () => {
    const contrast = {
      label: 'Contrast',
      default: 'lo',
      options: [
        { value: 'lo', label: 'Low' },
        { value: 'hi', label: 'High' },
      ],
    };
    const shell: ShellConfig = {
      globals: {
        contrast,
        theme: {
          label: 'Theme',
          default: 'auto',
          options: [...options, { value: 'light', label: 'Light' }],
          shows: (value, globals) => value !== 'light' || globals.contrast === 'hi',
        },
      },
    };
    mount(shell);
    const choose = async (menu: string, row: string) => {
      await open('Globals');
      await press(await screen.findByRole('menuitem', { name: menu }));
      await press(screen.getByRole('menuitemradio', { name: row }));
    };
    await choose('Contrast', 'High');
    await choose('Theme', 'Light');
    await open('Globals');
    await press(await screen.findByRole('menuitem', { name: 'Theme' }));
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
    await press(screen.getByRole('menuitemradio', { name: 'Light' }));
    await choose('Contrast', 'Low');
    await open('Globals');
    await press(await screen.findByRole('menuitem', { name: 'Theme' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Light' })).toBeNull();
    const checked = screen.getAllByRole('menuitemradio').filter((el) => el.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
  });
});
