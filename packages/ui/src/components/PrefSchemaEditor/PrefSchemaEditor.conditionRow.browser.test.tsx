import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { renderWithIcons } from '../../testing/withIcons';

// Whether a condition gets the attributes pane's width or only its control column is layout.

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: {
    units: { kind: 'enum', name: 'Units', description: '', default: 'px', options: [{ value: 'px', label: 'Pixels' }, { value: 'mm', label: 'Millimeters' }] } as PrefLeaf,
    size: { kind: 'number', name: 'Grid size', description: '', default: 8, showIf: { path: 'view.units', is: 'mm' }, enableIf: { path: 'view.units', isNot: 'px' } },
  } } },
};

const box = (el: Element) => el.getBoundingClientRect();

test('a condition runs the width of the attributes pane under its label, and a key beside its own', async () => {
  await page.viewport(1300, 720);
  renderWithIcons(<div style={{ width: 1280, height: 700 }}><PrefSchemaEditor schema={SCHEMA} onChange={() => {}} /></div>);
  fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('Grid size'));
  const pane = screen.getByRole('region', { name: 'Attributes' });
  for (const name of ['Shown if', 'Enabled if']) {
    const editor = box(within(pane).getByRole('group', { name }));
    const label = box(within(pane).getByText(name));
    expect(label.bottom, name).toBeLessThanOrEqual(editor.top + 0.5);
    expect(editor.width, name).toBeGreaterThan(pane.clientWidth * 0.8);
    expect(editor.left).toBeGreaterThanOrEqual(box(pane).left);
    expect(editor.right).toBeLessThanOrEqual(box(pane).right + 0.5);
  }
  const key = box(within(pane).getByRole('textbox', { name: 'Key' }));
  expect(box(within(pane).getByText('Key')).right).toBeLessThanOrEqual(key.left + 0.5);
});
