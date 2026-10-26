import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActionsProvider, type Action } from '@weasel-js/core';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { MenuBar } from './MenuBar';
import { menuBarTitles } from './menuBarTitles';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';

afterEach(cleanup);

const ran: string[] = [];
beforeEach(() => { ran.length = 0; });
const act1 = (id: string, label: string): Action => ({ id, label, invoker: { timing: 'immediate', run: () => { ran.push(id); } } });
const ACTIONS = [act1('file.new', 'New'), act1('file.open', 'Open'), act1('edit.undo', 'Undo')];

const SCHEMA: PrefGroup = pref.group('', {
  file: { ...pref.group('File', { new: pref.action('file.new'), open: pref.action('file.open') }, { as: 'menu' }), access: 'f' },
  edit: pref.group('Edit', { undo: pref.action('edit.undo') }, { as: 'menu' }),
});

/** File with a submenu first, so the first row opens it. */
const WITH_SUBMENU: PrefGroup = pref.group('', {
  file: pref.group('File', {
    more: pref.group('More', { open: pref.action('file.open') }, { as: 'menu' }),
    new: pref.action('file.new'),
  }, { as: 'menu' }),
  edit: SCHEMA.children.edit!,
});

function setup(schema = SCHEMA) {
  render(
    <ActionsProvider>
      <RegisterActions actions={ACTIONS} />
      <button type="button">Before</button>
      <MenuBar schema={schema} />
    </ActionsProvider>,
  );
  return { file: screen.getByRole('menuitem', { name: 'File' }), edit: screen.getByRole('menuitem', { name: 'Edit' }) };
}

const rowNames = () => screen.getAllByRole('menuitem').filter((el) => el.closest('[role="menu"]')).map((el) => el.textContent);

describe('menuBarTitles', () => {
  it('makes each menu group a title and each run of anything else one other', () => {
    const titles = menuBarTitles(pref.group('', {
      a: pref.group('A', {}, { as: 'menu' }),
      b: pref.boolean('B', false),
      c: pref.boolean('C', false),
      d: pref.group('D', {}, { as: 'menu' }),
    }));
    expect(titles.map((t) => t.kind)).toEqual(['menu', 'other', 'menu']);
    const other = titles[1]!;
    expect(other.kind === 'other' && Object.keys(other.schema.children)).toEqual(['b', 'c']);
  });
});

describe('MenuBar', () => {
  it('draws a menubar of titles, underlining a declared access letter', () => {
    const { file, edit } = setup();
    expect(screen.getByRole('menubar', { name: 'Menu bar' })).toBeDefined();
    expect(file.parentElement).toBe(screen.getByRole('menubar'));
    expect(file.querySelector('span span')?.textContent).toBe('F');
    expect(edit.querySelector('span span')).toBeNull();
    expect(file.getAttribute('aria-haspopup')).toBe('menu');
    expect([file.tabIndex, edit.tabIndex]).toEqual([0, -1]);
  });

  it('opens a title’s menu on press, and closes it on a second press', () => {
    const { file } = setup();
    fireEvent.pointerDown(file);
    expect(screen.getByRole('menu').getAttribute('aria-labelledby')).toBe(file.id);
    expect(rowNames()).toEqual(['New', 'Open']);
    expect(file.getAttribute('aria-expanded')).toBe('true');
    fireEvent.pointerDown(file);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('switches to another title’s menu when the pointer moves onto it', () => {
    const { file, edit } = setup();
    fireEvent.pointerDown(file);
    fireEvent.pointerEnter(edit);
    expect(rowNames()).toEqual(['Undo']);
  });

  it('runs the row a press on a title is released over', () => {
    const { file } = setup();
    fireEvent.pointerDown(file);
    fireEvent.pointerUp(screen.getByRole('menuitem', { name: 'Open' }));
    expect(ran).toEqual(['file.open']);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps the menu open, running nothing, when a press is released off any row', () => {
    const { file } = setup();
    fireEvent.pointerDown(file);
    fireEvent.pointerUp(file);
    expect(screen.getByRole('menu')).toBeDefined();
    expect(ran).toEqual([]);
  });

  it('walks the titles with Left and Right, and opens one with Down, its first row highlighted', () => {
    const { file, edit } = setup();
    act(() => file.focus());
    fireEvent.keyDown(file, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(edit);
    fireEvent.keyDown(edit, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(file);
    fireEvent.keyDown(file, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(edit);
    fireEvent.keyDown(edit, { key: 'ArrowDown' });
    const menu = screen.getByRole('menu');
    expect(rowNames()).toEqual(['Undo']);
    expect(menu.getAttribute('aria-activedescendant')).toBe(screen.getByRole('menuitem', { name: 'Undo' }).id);
  });

  it('moves to the neighboring menu, open, on Left or Right inside one', () => {
    const { file } = setup();
    act(() => file.focus());
    fireEvent.keyDown(file, { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
    expect(rowNames()).toEqual(['Undo']);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
    expect(rowNames()).toEqual(['New', 'Open']);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
    expect(rowNames()).toEqual(['Undo']);
    expect(document.activeElement).toBe(screen.getByRole('menu'));
  });

  it('closes on Escape to its title, and leaves the bar on a second Escape', () => {
    const { file } = setup();
    const before = screen.getByRole('button', { name: 'Before' });
    act(() => before.focus());
    act(() => file.focus());
    fireEvent.keyDown(file, { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(file);
    fireEvent.keyDown(file, { key: 'Escape' });
    expect(document.activeElement).toBe(before);
  });

  it('draws a run of non-menu entries after the menubar, outside it', () => {
    render(
      <MenuBar
        schema={pref.group('', {
          file: pref.group('File', { snap: pref.boolean('Snap', false) }, { as: 'menu' }),
          zoom: pref.number('Zoom', 100),
          edit: pref.group('Edit', { grid: pref.boolean('Grid', false) }, { as: 'menu' }),
        })}
        values={{ zoom: 150 }}
      />,
    );
    const bar = screen.getByRole('menubar');
    expect(bar.textContent).not.toContain('Zoom');
    expect([...bar.children].map((el) => el.getAttribute('role'))).toEqual(['menuitem', 'menuitem']);
    expect(bar.parentElement!.textContent).toContain('Zoom');
  });

  it('gives focus back to where it was after a menu opened by press is escaped twice', () => {
    const { file } = setup();
    const before = screen.getByRole('button', { name: 'Before' });
    act(() => before.focus());
    fireEvent.pointerDown(file);
    expect(document.activeElement).toBe(screen.getByRole('menu'));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(document.activeElement).toBe(file);
    fireEvent.keyDown(file, { key: 'Escape' });
    expect(document.activeElement).toBe(before);
  });

  it('gives focus back to where it was, not to the title, when a row runs', () => {
    const { file } = setup();
    const before = screen.getByRole('button', { name: 'Before' });
    act(() => before.focus());
    fireEvent.pointerDown(file);
    fireEvent.pointerUp(screen.getByRole('menuitem', { name: 'Open' }));
    expect(ran).toEqual(['file.open']);
    expect(document.activeElement).toBe(before);
  });
});

describe('MenuBar focus after a dismiss that is not Escape', () => {
  /** Opens File's submenu from the keyboard, with focus first on Before, and closes only the submenu on Escape. */
  async function escapeSubmenu() {
    const { file } = setup(WITH_SUBMENU);
    const before = screen.getByRole('button', { name: 'Before' });
    act(() => before.focus());
    act(() => file.focus());
    fireEvent.keyDown(file, { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
    expect(screen.getAllByRole('menu')).toHaveLength(2);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    // Past the Escape keydown's own task, as a later dismiss would be.
    await act(() => new Promise((r) => setTimeout(r, 0)));
    return before;
  }

  it('gives focus back, not to the title, when a wheel closes the menu', async () => {
    const before = await escapeSubmenu();
    fireEvent.wheel(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(before);
  });

  it('gives focus back, not to the title, when a window blur closes the menu', async () => {
    const before = await escapeSubmenu();
    fireEvent.blur(window);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(before);
  });
});

describe('MenuBar conditions', () => {
  const GATED: PrefGroup = pref.group('', {
    on: pref.boolean('On', false),
    file: { ...pref.group('File', { new: pref.action('file.new') }, { as: 'menu' }), showIf: { path: 'on' } },
    edit: { ...pref.group('Edit', { undo: pref.action('edit.undo') }, { as: 'menu' }), enableIf: { path: 'on' } },
  });
  const gated = (on: boolean) => render(
    <ActionsProvider>
      <RegisterActions actions={ACTIONS} />
      <MenuBar schema={GATED} values={{ on }} />
    </ActionsProvider>,
  );

  it('leaves out a title whose showIf fails', () => {
    gated(false);
    expect(screen.queryByRole('menuitem', { name: 'File' })).toBeNull();
    cleanup();
    gated(true);
    expect(screen.getByRole('menuitem', { name: 'File' })).toBeDefined();
  });

  it('marks a title whose enableIf fails disabled, and opens it neither by press nor by key', () => {
    gated(false);
    const edit = screen.getByRole('menuitem', { name: 'Edit' });
    expect(edit.getAttribute('aria-disabled')).toBe('true');
    fireEvent.pointerDown(edit);
    act(() => edit.focus());
    for (const key of ['ArrowDown', 'Enter', ' ']) fireEvent.keyDown(edit, { key });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  const openThenFlip = (title: 'File' | 'Edit') => {
    const tree = (on: boolean) => (
      <ActionsProvider>
        <RegisterActions actions={ACTIONS} />
        <MenuBar schema={GATED} values={{ on }} />
      </ActionsProvider>
    );
    const { rerender } = render(tree(true));
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: title }));
    expect(screen.getByRole('menu')).toBeDefined();
    rerender(tree(false));
  };

  it('closes an open menu whose title becomes hidden', () => {
    openThenFlip('File');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes an open menu whose title becomes disabled', () => {
    openThenFlip('Edit');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Edit' }).getAttribute('aria-expanded')).not.toBe('true');
  });
});
