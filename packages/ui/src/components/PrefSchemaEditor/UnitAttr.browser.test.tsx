import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { renderWithIcons } from '../../testing/withIcons';

// Whether the unit's fields fit the attributes pane on their rows is the browser's layout to say.

afterEach(cleanup);

beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = '.unit-editor-box { width: 1280px; height: 700px; }';
  document.head.append(style);
});

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: {
    heat: { kind: 'number', name: 'Heat', description: '', default: 300, unit: { suffix: '°C', scale: 1, offset: 273.15, precision: 1, accepts: { K: { factor: 1, offset: -273.15 } } } },
  } } },
};

test('the unit\'s four fields share a line inside the pane, and an accepted suffix sits on a line of its own under them', async () => {
  await page.viewport(1300, 720);
  renderWithIcons(<div className="unit-editor-box"><PrefSchemaEditor schema={SCHEMA} onChange={() => {}} /></div>);
  fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('heat'));
  const pane = screen.getByRole('region', { name: 'Attributes' });
  const box = (name: string) => within(pane).getByRole('textbox', { name }).getBoundingClientRect();
  const fields = ['Unit suffix', 'Unit scale', 'Unit offset', 'Unit places'].map(box);
  const edge = pane.getBoundingClientRect();
  for (const [i, field] of fields.entries()) {
    expect(field.top).toBe(fields[0]!.top);
    expect(field.width).toBeGreaterThanOrEqual(40);
    expect(field.left).toBeGreaterThanOrEqual(i === 0 ? edge.left : fields[i - 1]!.right);
    expect(field.right).toBeLessThanOrEqual(edge.right);
  }
  const accepted = ['Accepted suffix 1', 'Accepted suffix 1 scale', 'Accepted suffix 1 offset'].map(box);
  for (const field of accepted) {
    expect(field.top).toBe(accepted[0]!.top);
    expect(field.top).toBeGreaterThanOrEqual(fields[0]!.bottom);
    expect(field.width).toBeGreaterThanOrEqual(40);
  }
  expect(within(pane).getByRole('button', { name: 'Remove accepted suffix 1' }).getBoundingClientRect().right).toBeLessThanOrEqual(edge.right);
  expect(within(pane).getByRole('textbox', { name: 'Unit scale' })).toHaveValue('1');
  expect(within(pane).getByRole('textbox', { name: 'Accepted suffix 1 offset' })).toHaveValue('-273.15');
});
