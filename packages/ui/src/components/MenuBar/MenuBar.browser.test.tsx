import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { ActionsProvider, type Action } from '@weasel-js/core';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { MenuBar } from './MenuBar';
import s from './MenuBar.browser.test.module.css';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';

afterEach(cleanup);

const ran: string[] = [];
beforeEach(async () => {
  ran.length = 0;
  await page.viewport(800, 600);
});
const act1 = (id: string, label: string): Action => ({ id, label, invoker: { timing: 'immediate', run: () => { ran.push(id); } } });
const ACTIONS = [act1('file.new', 'New'), act1('file.open', 'Open'), act1('edit.undo', 'Undo')];
const SCHEMA: PrefGroup = pref.group('', {
  file: pref.group('File', { new: pref.action('file.new'), open: pref.action('file.open') }, { as: 'menu' }),
  edit: pref.group('Edit', { undo: pref.action('edit.undo') }, { as: 'menu' }),
});

function setup() {
  render(
    <ActionsProvider>
      <RegisterActions actions={ACTIONS} />
      <MenuBar schema={SCHEMA} />
      <div className={s.far} data-testid="far" />
    </ActionsProvider>,
  );
  return screen.getByRole('menuitem', { name: 'File' });
}

const rows = () => [...screen.getByRole('menu').querySelectorAll('[role="menuitem"]')].map((el) => el.textContent);

it('hangs the menu from its title’s bottom edge, aligned to its left', async () => {
  const title = setup();
  await userEvent.click(title);
  const t = title.getBoundingClientRect();
  const m = screen.getByRole('menu').getBoundingClientRect();
  expect(Math.abs(m.top - t.bottom)).toBeLessThanOrEqual(1);
  expect(Math.abs(m.left - t.left)).toBeLessThanOrEqual(1);
});

it('runs a row on a press dragged from its title and released over it', async () => {
  setup();
  await userEvent.dragAndDrop(page.getByRole('menuitem', { name: 'File' }), page.getByRole('menuitem', { name: 'Open' }));
  expect(ran).toEqual(['file.open']);
  expect(screen.queryByRole('menu')).toBeNull();
});

it('keeps the menu open, running nothing, on a press dragged from its title and released off the menu', async () => {
  setup();
  await userEvent.dragAndDrop(page.getByRole('menuitem', { name: 'File' }), page.getByTestId('far'));
  expect(rows()).toEqual(['New', 'Open']);
  expect(ran).toEqual([]);
});

it('closes the menu on a second press of its title', async () => {
  const title = setup();
  await userEvent.click(title);
  expect(screen.getByRole('menu')).toBeTruthy();
  await userEvent.click(title);
  expect(screen.queryByRole('menu')).toBeNull();
});

it('switches to another title’s menu when the pointer moves onto it', async () => {
  const title = setup();
  await userEvent.click(title);
  await userEvent.hover(screen.getByRole('menuitem', { name: 'Edit' }));
  expect(rows()).toEqual(['Undo']);
});

function setupTitle(access?: string) {
  const schema = pref.group('', { file: pref.group('File', { new: pref.action('file.new') }, { as: 'menu', access }) });
  render(
    <ActionsProvider>
      <RegisterActions actions={ACTIONS} />
      <MenuBar schema={schema} />
    </ActionsProvider>,
  );
  return screen.getByRole('menuitem', { name: 'File' });
}

it('names a title by its whole label when it underlines an access letter', () => {
  const title = setupTitle('f');
  expect(page.getByRole('menuitem', { name: 'File', exact: true }).elements()).toHaveLength(1);
  const underlined = title.querySelectorAll('span span');
  expect(underlined).toHaveLength(1);
  expect(underlined[0]?.textContent).toBe('F');
});

it('names a title by its label, underlining nothing, when its access letter is not in it', () => {
  const title = setupTitle('z');
  expect(title.querySelectorAll('span span')).toHaveLength(0);
  expect(title.textContent).toBe('File');
});
