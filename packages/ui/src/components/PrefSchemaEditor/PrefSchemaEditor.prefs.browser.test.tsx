import '@weasel-js/theme/tokens.css';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

// A drop into the live preview is hit-tested against the form's layout, which only a browser has.

beforeAll(() => page.viewport(1500, 800));
afterEach(cleanup);

const leaf = (name: string) => ({ kind: 'boolean', name, description: '', default: false }) as const;
const START: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: { grid: leaf('Show grid'), snap: leaf('Snap'), dock: leaf('Dock') } } },
};

let latest = START;
function Live() {
  const [schema, setSchema] = useState(START);
  latest = schema;
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

const preview = () => within(screen.getByRole('region', { name: 'Live preview' }));
const selectedRows = () => within(screen.getByRole('tree', { name: 'Schema structure' })).queryAllByRole('treeitem', { selected: true });
const order = () => Object.keys((latest.children.view as PrefGroup).children);

/** Drag the preview row reading `from` onto the top of the one reading `onto`. */
async function drag(from: string, onto: string) {
  const a = preview().getByText(from).getBoundingClientRect();
  const b = preview().getByText(onto).getBoundingClientRect();
  const [x0, y0, x1, y1] = [a.left + 4, a.top + a.height / 2, b.left + 4, b.top + 2];
  const opts = (x: number, y: number) => ({ bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: y, isPrimary: true });
  await act(async () => {
    preview().getByText(from).dispatchEvent(new PointerEvent('pointerdown', opts(x0, y0)));
    for (let i = 1; i <= 8; i++) document.dispatchEvent(new PointerEvent('pointermove', opts(x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8)));
    await new Promise((r) => setTimeout(r, 50));
    document.dispatchEvent(new PointerEvent('pointermove', opts(x1, y1)));
    document.dispatchEvent(new PointerEvent('pointerup', opts(x1, y1)));
  });
}

test('a row dropped in the live preview becomes the selection', async () => {
  render(<Live />);
  await drag('Dock', 'Show grid');
  expect(order()).not.toEqual(['grid', 'snap', 'dock']);
  expect(selectedRows().map((r) => r.textContent)).toEqual([expect.stringContaining('(dock)')]);
});

test('with "Select what is dropped" off in the editor\'s preferences, the selection stays where it was', async () => {
  render(<Live />);
  fireEvent.click(screen.getByRole('button', { name: 'Preferences' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Schema editor preferences' })).getByRole('checkbox', { name: 'Select what is dropped' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Schema editor preferences' })).getByRole('button', { name: 'Close dialog' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Schema editor preferences' })).toBeNull());
  fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('(snap)'));
  await drag('Dock', 'Show grid');
  expect(order()).not.toEqual(['grid', 'snap', 'dock']);
  expect(selectedRows().map((r) => r.textContent)).toEqual([expect.stringContaining('(snap)')]);
});
