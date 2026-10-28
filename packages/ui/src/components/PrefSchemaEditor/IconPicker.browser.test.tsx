import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { IconRegistryProvider } from '@weasel-js/core';
import type { IconTable } from '@weasel-js/icons';
import type { PrefGroup } from '@weasel-js/prefs';
import { kitIcons } from '../../kitIcons';
import { PrefSchemaEditor } from './PrefSchemaEditor';

// Whether the grid scrolls in its own pane, and whether a glyph occupies any space, is the browser's to say.

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: { grid: { kind: 'boolean', name: 'Show grid', description: '', default: true } } } },
};

const big: IconTable = {
  namespace: 'big',
  owner: 'test',
  icons: Object.fromEntries(Array.from({ length: 240 }, (_, i) => [`g${i}`, { body: '<path d="M3 3h14v14H3z"/>', group: `Set ${i % 4}`, tags: [] }])),
};

const mount = async (onChange: (next: PrefGroup) => void = () => {}) => {
  await page.viewport(1300, 720);
  const loader = vi.fn(async () => ({ default: [big] }));
  const out = render(
    <IconRegistryProvider icons={kitIcons} variants={{ all: loader }}>
      <div style={{ width: 1280, height: 700 }}>
        <PrefSchemaEditor schema={SCHEMA} onChange={onChange} />
      </div>
    </IconRegistryProvider>,
  );
  fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('Show grid'));
  fireEvent.click(screen.getByRole('button', { name: 'Select icon' }));
  return { ...out, grid: await screen.findByRole('listbox', { name: 'Icons' }) };
};

test('the grid scrolls inside its own pane and the page does not', async () => {
  const { grid } = await mount();
  expect(grid.scrollHeight).toBeGreaterThan(grid.clientHeight);
  grid.scrollTop = 200;
  expect(grid.scrollTop).toBeGreaterThan(0);
  window.scrollTo(0, 5000);
  expect(window.scrollY).toBe(0);
});

test('a cell draws a glyph with a box', async () => {
  const { grid } = await mount();
  const glyph = grid.querySelector('[role="option"] svg') as SVGSVGElement;
  expect(glyph.getBBox().width).toBeGreaterThan(0);
});

test('ArrowDown moves to the cell in the next row, and Enter chooses it', async () => {
  const onChange = vi.fn<(next: PrefGroup) => void>();
  const { grid } = await mount(onChange);
  grid.focus();
  const first = grid.querySelector('[role="option"]')!.getBoundingClientRect();
  fireEvent.keyDown(grid, { key: 'ArrowDown' });
  const active = () => document.getElementById(grid.getAttribute('aria-activedescendant')!)!;
  await waitFor(() => {
    expect(active().getBoundingClientRect().top).toBeGreaterThan(first.top);
    expect(Math.abs(active().getBoundingClientRect().left - first.left)).toBeLessThan(1);
  });
  const chosen = active().getAttribute('aria-label');
  fireEvent.keyDown(grid, { key: 'Enter' });
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  const view = onChange.mock.lastCall![0].children.view as PrefGroup;
  expect(view.children.grid).toMatchObject({ icon: chosen });
});
