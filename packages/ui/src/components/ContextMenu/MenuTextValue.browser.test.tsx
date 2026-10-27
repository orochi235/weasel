import '@weasel-js/theme/tokens.css';
import type { MenuEntry } from '@weasel-js/menu';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { OpenPanels } from './ContextMenuHost';

// Whether a typed key reaches the field or the menu's typeahead, and whether the field fits its row, need a real
// browser's keyboard and layout.

afterEach(cleanup);

function open() {
  const set = vi.fn();
  const close = vi.fn();
  const entries: MenuEntry[] = [
    { kind: 'item', key: 'cut', label: 'Cut', run: () => {} },
    { kind: 'text', key: 'name', label: 'Name', value: 'Layer 1', set },
    { kind: 'item', key: 'nudge', label: 'Nudge', run: () => {} },
  ];
  render(<OpenPanels open={{ seq: 1, entries, client: { x: 20, y: 20 }, source: 'keyboard' }} close={close} />);
  return { set, close, menu: screen.getByRole('menu') };
}

it('takes typed text, the menu’s typeahead included, and commits it on Enter without closing', async () => {
  const { set, close, menu } = open();
  const field = screen.getByRole('textbox', { name: 'Name' });
  await userEvent.click(field);
  await userEvent.keyboard('{Control>}a{/Control}{Meta>}a{/Meta}');
  // `n` would move the highlight to Nudge if the menu read it.
  await userEvent.keyboard('Nested');
  expect(field).toHaveValue('Nested');
  expect(document.activeElement).toBe(field);
  await userEvent.keyboard('{Enter}');
  expect(set).toHaveBeenCalledWith('Nested');
  expect(close).not.toHaveBeenCalled();
  expect(menu.isConnected).toBe(true);
});

it('fits the field inside its row and the row inside the menu', () => {
  const { menu } = open();
  const field = screen.getByRole('textbox', { name: 'Name' }).getBoundingClientRect();
  const row = screen.getByRole('menuitem', { name: /Name/ }).getBoundingClientRect();
  const panel = menu.getBoundingClientRect();
  expect(field.left).toBeGreaterThanOrEqual(row.left);
  expect(field.right).toBeLessThanOrEqual(row.right + 0.5);
  expect(field.top).toBeGreaterThanOrEqual(row.top - 0.5);
  expect(field.bottom).toBeLessThanOrEqual(row.bottom + 0.5);
  expect(row.right).toBeLessThanOrEqual(panel.right + 0.5);
});
