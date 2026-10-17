import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { ActionsProvider, useAction, type Action } from '@weasel-js/core';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { MenuBar } from './MenuBar';

afterEach(cleanup);

const ran: string[] = [];
const act1 = (id: string, label: string): Action => ({ id, label, invoker: { timing: 'immediate', run: () => { ran.push(id); } } });
const ACTIONS = [act1('file.new', 'New'), act1('file.open', 'Open')];
const SCHEMA: PrefGroup = pref.group('', {
  file: pref.group('File', { new: pref.action('file.new'), open: pref.action('file.open') }, { as: 'menu' }),
});

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}

function Setup() {
  return (
    <>
      {ACTIONS.map((a) => <Register key={a.id} action={a} />)}
      <MenuBar schema={SCHEMA} />
    </>
  );
}

it('hangs the menu from its title’s bottom edge, aligned to its left', async () => {
  await page.viewport(800, 600);
  render(<ActionsProvider><Setup /></ActionsProvider>);
  const title = screen.getByRole('menuitem', { name: 'File' });
  await userEvent.click(title);
  const t = title.getBoundingClientRect();
  const m = screen.getByRole('menu').getBoundingClientRect();
  expect(Math.abs(m.top - t.bottom)).toBeLessThanOrEqual(1);
  expect(m.left).toBe(t.left);
});

it('runs a row on a press dragged from its title and released over it', async () => {
  ran.length = 0;
  await page.viewport(800, 600);
  render(<ActionsProvider><Setup /></ActionsProvider>);
  await userEvent.dragAndDrop(page.getByRole('menuitem', { name: 'File' }), page.getByRole('menuitem', { name: 'Open' }));
  expect(ran).toEqual(['file.open']);
  expect(screen.queryByRole('menu')).toBeNull();
});
