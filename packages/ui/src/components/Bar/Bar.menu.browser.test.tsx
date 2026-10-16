import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { ActionsProvider, useAction, type Action } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { Bar } from './Bar';

afterEach(cleanup);

const ACTIONS: Action[] = [
  { id: 'front', label: 'Bring to front', group: 'arrange', invoker: { timing: 'immediate', run: () => {} } },
  { id: 'back', label: 'Send to back', group: 'arrange', invoker: { timing: 'immediate', run: () => {} } },
];

function Setup() {
  useAction(ACTIONS[0]!);
  useAction(ACTIONS[1]!);
  return <Bar framed label="Tools" schema={pref.group('', { arrange: pref.group('Arrange', { order: pref.actions('arrange') }, { as: 'menu' }) })} />;
}

it('opens the menu under its button, on screen, and gives focus back when it closes', async () => {
  await page.viewport(800, 600);
  render(<ActionsProvider><Setup /></ActionsProvider>);
  const trigger = screen.getByRole('button', { name: 'Arrange' });
  await userEvent.click(trigger);
  const menu = screen.getByRole('menu');
  const below = trigger.getBoundingClientRect();
  const at = menu.getBoundingClientRect();
  expect(Math.abs(at.top - below.bottom)).toBeLessThanOrEqual(2);
  expect(Math.abs(at.left - below.left)).toBeLessThanOrEqual(2);
  expect(at.right).toBeLessThanOrEqual(800);
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('closes on a second press of its button rather than reopening', async () => {
  render(<ActionsProvider><Setup /></ActionsProvider>);
  const trigger = screen.getByRole('button', { name: 'Arrange' });
  await userEvent.click(trigger);
  expect(screen.getByRole('menu')).toBeDefined();
  await userEvent.click(trigger);
  expect(screen.queryByRole('menu')).toBeNull();
});
