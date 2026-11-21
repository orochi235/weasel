import { afterEach, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MenuEntry } from '@weasel-js/menu';
import { OpenPanels } from './ContextMenuHost';

afterEach(cleanup);

it('scrolls a panel taller than its box to keep the highlighted row in view', () => {
  const entries: MenuEntry[] = ['a', 'b', 'c'].map((key) => ({ kind: 'item', key, label: key, run: () => {} }));
  render(<OpenPanels open={{ seq: 1, entries, client: { x: 0, y: 0 }, source: 'pointer' }} close={() => {}} />);
  const menu = screen.getByRole('menu');
  Object.defineProperty(menu, 'clientHeight', { value: 50 });
  menu.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 200, height: 50 });
  screen.getAllByRole('menuitem').forEach((row, i) => {
    Object.defineProperty(row, 'offsetHeight', { value: 30 });
    row.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: i * 30 - menu.scrollTop, width: 200, height: 30 });
  });
  for (const k of ['ArrowDown', 'ArrowDown', 'ArrowDown']) act(() => { fireEvent.keyDown(menu, { key: k }); });
  expect(menu.scrollTop).toBe(40);
  act(() => { fireEvent.keyDown(menu, { key: 'Home' }); });
  expect(menu.scrollTop).toBe(0);
});
