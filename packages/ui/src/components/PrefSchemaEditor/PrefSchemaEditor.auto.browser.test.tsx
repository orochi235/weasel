import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { renderWithIcons } from '../../testing/withIcons';

// Whether the switch and its control share a line, and whether a faded control still takes a press, are layout.

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: { gap: { kind: 'number', name: 'Gap', description: '', default: 12 } } } },
};

test('an unset auto value draws its switch before a faded control on one line, and the control takes no press', async () => {
  await page.viewport(1300, 720);
  renderWithIcons(
    <div style={{ width: 1280, height: 700 }}>
      <PrefSchemaEditor schema={SCHEMA} onChange={() => {}} />
    </div>,
  );
  fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('gap'));
  const attributes = within(screen.getByRole('region', { name: 'Attributes' }));
  const input = attributes.getByRole('spinbutton', { name: 'Auto value' });
  input.scrollIntoView({ block: 'center' });
  const toggle = attributes.getByRole('switch', { name: 'Set Auto value' }).closest('label')!.getBoundingClientRect();
  const field = input.getBoundingClientRect();
  const label = attributes.getByText('Auto value').getBoundingClientRect();

  expect(toggle.width).toBeGreaterThan(0);
  expect(toggle.right).toBeLessThanOrEqual(field.left);
  expect(label.right).toBeLessThanOrEqual(toggle.left);
  // One line: each box's middle falls inside the other's.
  const mid = (r: DOMRect): number => (r.top + r.bottom) / 2;
  expect(mid(toggle)).toBeGreaterThan(field.top);
  expect(mid(toggle)).toBeLessThan(field.bottom);
  expect(mid(label)).toBeGreaterThan(field.top);
  expect(mid(label)).toBeLessThan(field.bottom);

  const fieldset = input.closest('fieldset')!;
  expect(getComputedStyle(fieldset).opacity).toBe('0.5');
  const hit = document.elementFromPoint(field.left + field.width / 2, mid(field));
  expect(hit).not.toBeNull();
  expect(hit!.closest('fieldset')).toBeNull();
  // The default's own row is the same width, so the two values line up down the pane.
  const def = attributes.getByRole('spinbutton', { name: 'Default' }).getBoundingClientRect();
  expect(Math.abs(def.right - field.right)).toBeLessThan(40);
});
