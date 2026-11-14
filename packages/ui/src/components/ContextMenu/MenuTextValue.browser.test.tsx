import '@weasel-js/theme/tokens.css';
import type { MenuEntry } from '@weasel-js/menu';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { OpenPanels } from '@weasel-js/ui/testing/contextMenu';

// Whether a typed key reaches the field or the menu's typeahead, and whether the field fits its row, need a real
// browser's keyboard and layout.

afterEach(cleanup);

/** The event being dispatched when a callback runs, so a failure names what closed the menu or wrote the row. */
function cause(): string {
  const e = window.event;
  if (!e) return 'no event';
  const t = e.target;
  const role = t instanceof Element ? t.getAttribute('role') : null;
  const at = t instanceof Element ? `${t.tagName.toLowerCase()}${role ? `[role=${role}]` : ''}` : t === window ? 'window' : String(t);
  return `${e.type} on ${at}${e.isTrusted ? '' : ' (untrusted)'}`;
}

function open() {
  const set = vi.fn((_value: string) => cause());
  const close = vi.fn(() => cause());
  const entries: MenuEntry[] = [
    { kind: 'item', key: 'cut', label: 'Cut', run: () => {} },
    { kind: 'text', key: 'name', label: 'Name', value: 'Layer 1', set },
    { kind: 'item', key: 'nudge', label: 'Nudge', run: () => {} },
    { kind: 'number', key: 'size', label: 'Size', value: 12, set: () => {} },
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
  // Enter wrote it, not a blur that happened to commit the same text.
  expect(set.mock.results.map((r) => r.value)).toEqual(['keydown on input']);
  expect(close.mock.results.map((r) => r.value)).toEqual([]);
  expect(menu.isConnected).toBe(true);
});

it('fits each field inside its row and the row inside the menu', () => {
  const { menu } = open();
  const panel = menu.getBoundingClientRect();
  for (const name of ['Name', 'Size']) {
    const rowEl = screen.getByRole('menuitem', { name: new RegExp(name) });
    const row = rowEl.getBoundingClientRect();
    const field = rowEl.querySelector('input')!.getBoundingClientRect();
    expect(field.left, name).toBeGreaterThanOrEqual(row.left);
    expect(field.right, name).toBeLessThanOrEqual(row.right + 0.5);
    expect(field.top, name).toBeGreaterThanOrEqual(row.top - 0.5);
    expect(field.bottom, name).toBeLessThanOrEqual(row.bottom + 0.5);
    expect(row.right, name).toBeLessThanOrEqual(panel.right + 0.5);
  }
});
