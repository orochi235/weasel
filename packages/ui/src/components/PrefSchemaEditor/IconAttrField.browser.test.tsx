import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { IconRegistryProvider } from '@weasel-js/core';
import { icons as coreIcons } from '@weasel-js/core/icons';
import type { IconTable } from '@weasel-js/icons';
import type { PrefGroup } from '@weasel-js/prefs';
import { icons as uiIcons } from '../../icons.table';
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

const mount = async () => {
  await page.viewport(1300, 720);
  const loader = vi.fn(async () => ({ default: [big] }));
  const out = render(
    <IconRegistryProvider icons={[coreIcons, uiIcons]} variants={{ all: loader }}>
      <div style={{ width: 1280, height: 700 }}>
        <PrefSchemaEditor schema={SCHEMA} onChange={() => {}} />
      </div>
    </IconRegistryProvider>,
  );
  fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('Show grid'));
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
  const { grid } = await mount();
  grid.focus();
  const first = grid.querySelector('[role="option"]')!.getBoundingClientRect();
  fireEvent.keyDown(grid, { key: 'ArrowDown' });
  await waitFor(() => {
    const active = document.getElementById(grid.getAttribute('aria-activedescendant')!)!.getBoundingClientRect();
    expect(active.top).toBeGreaterThan(first.top);
    expect(Math.abs(active.left - first.left)).toBeLessThan(1);
  });
});
