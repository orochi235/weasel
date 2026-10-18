import '@weasel-js/theme/tokens.css';
import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { Tool, ToolsApi } from '@weasel-js/core';
import { ToolPalette } from './ToolPalette';

afterEach(cleanup);

const tool = (id: string, group = 'shape'): Tool =>
  ({ id, keybinding: { key: id[0] }, presentation: { label: id, group } }) as Tool;
const LIST = [tool('select', 'select'), tool('rect'), tool('ellipse'), tool('star')];

function Palette() {
  const [active, setActive] = useState('select');
  const tools = { registry: Object.fromEntries(LIST.map((t) => [t.id, t])), active, setActive } as unknown as ToolsApi;
  return <ToolPalette tools={tools} stacks={[['rect', 'ellipse', 'star']]} />;
}

const stack = () => screen.getByRole('button', { name: /rect|ellipse|star/ });

it('opens the stack menu beside the button on a real click, and draws the corner mark inside it', async () => {
  render(<Palette />);
  const mark = stack().lastElementChild!.getBoundingClientRect();
  const btn = stack().getBoundingClientRect();
  expect(mark.width).toBeGreaterThan(0);
  expect(mark.right).toBeLessThanOrEqual(btn.right);
  expect(mark.bottom).toBeLessThanOrEqual(btn.bottom);

  await userEvent.click(stack());
  const menu = screen.getByRole('menu').getBoundingClientRect();
  expect(menu.top).toBeGreaterThanOrEqual(btn.top);
  await userEvent.click(screen.getByRole('menuitem', { name: /star/ }));
  expect(screen.queryByRole('menu')).toBeNull();
  expect(stack().textContent).toContain('star');
});

it('steps through the stack on a real alt-click', async () => {
  render(<Palette />);
  await userEvent.keyboard('{Alt>}');
  await userEvent.click(stack());
  await userEvent.keyboard('{/Alt}');
  expect(screen.queryByRole('menu')).toBeNull();
  expect(stack().textContent).toContain('ellipse');
  expect(stack().getAttribute('aria-current')).toBe('true');
});
