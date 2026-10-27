import '@weasel-js/theme/tokens.css';
import type { MenuEntry } from '@weasel-js/menu';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { OpenPanels } from './ContextMenuHost';

// Where the popover lands, and whether a real press inside it reaches the menu's dismiss as inside, need a real
// browser's layout and pointer events.

afterEach(cleanup);

function open() {
  const set = vi.fn();
  const close = vi.fn();
  const entries: MenuEntry[] = [
    { kind: 'item', key: 'cut', label: 'Cut', run: () => {} },
    { kind: 'color', key: 'fill', label: 'Fill', value: '#336699', alpha: true, set },
  ];
  render(
    <>
      <button type="button">Outside</button>
      <OpenPanels open={{ seq: 1, entries, client: { x: 20, y: 60 }, source: 'keyboard' }} close={close} />
    </>,
  );
  return { set, close, menu: screen.getByRole('menu'), row: screen.getByRole('menuitem', { name: /^Fill/ }) };
}

it('opens its popover beside the row, and a press inside it leaves the menu open', async () => {
  const { close, menu, row } = open();
  await userEvent.click(row);
  const picker = await screen.findByRole('dialog', { name: 'Fill color' });
  const p = picker.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  expect(p.left).toBeGreaterThanOrEqual(r.right - 1);
  expect(p.width).toBeGreaterThan(0);
  await userEvent.click(screen.getByRole('slider'));
  expect(close).not.toHaveBeenCalled();
  expect(menu.isConnected).toBe(true);
});

it('closes the menu on a press outside both', async () => {
  const { close, row } = open();
  await userEvent.click(row);
  await screen.findByRole('dialog', { name: 'Fill color' });
  await userEvent.click(screen.getByRole('button', { name: 'Outside' }));
  expect(close).toHaveBeenCalled();
});
