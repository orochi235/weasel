import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { prefType, type PrefGroup, type PrefObject } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

// Whether the entry's rows fit the attributes pane is layout, which jsdom does not do.

afterEach(cleanup);

const GradientStop = prefType('GradientStop', {
  kind: 'object', name: 'Stop', description: '', default: { at: 0.5, color: '#888888' },
  children: {
    at: { kind: 'number', name: 'At', description: '', default: 0.5, min: 0, max: 1 },
    color: { kind: 'color', name: 'Color', description: '', default: '#888888' },
  },
} satisfies PrefObject);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    gradient: { name: 'Gradient', children: {
      stops: { kind: 'list', name: 'Stops', description: '', default: [], item: GradientStop },
    } },
  },
};

test('a list\'s entry is edited inside the attributes pane, its type\'s own control drawing the default', async () => {
  await page.viewport(1300, 800);
  render(
    <div style={{ width: 1280, height: 780 }}>
      <PrefSchemaEditor schema={SCHEMA} onChange={() => {}} types={[GradientStop]} />
    </div>,
  );
  await userEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('(stops)'));
  const pane = screen.getByRole('region', { name: 'Attributes' });
  const bounds = pane.getBoundingClientRect();
  const picker = within(pane).getByRole('button', { name: /Entry kind/ });
  expect(picker).toHaveTextContent('GradientStop');
  const rows = pane.querySelectorAll('[data-pref-path^="$entry."]');
  expect(rows.length).toBeGreaterThanOrEqual(3);
  // The type's fields, drawn as the control for what a new entry starts as.
  const fields = pane.querySelectorAll('[data-pref-path="$entry.default"] :is(input, button)');
  expect(fields.length).toBeGreaterThanOrEqual(2);
  for (const el of [...rows, ...fields]) {
    const box = el.getBoundingClientRect();
    expect(box.width).toBeGreaterThan(0);
    expect(box.left).toBeGreaterThanOrEqual(bounds.left);
    expect(box.right).toBeLessThanOrEqual(bounds.right + 1);
  }});
