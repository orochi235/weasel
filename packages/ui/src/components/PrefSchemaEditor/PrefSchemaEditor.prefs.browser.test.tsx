import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { drag as dragTo } from './pointerDrag.fixture';
import { rowKey } from './treeRows.fixture';

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
function drag(from: string, onto: string) {
  const a = preview().getByText(from).getBoundingClientRect();
  const b = preview().getByText(onto).getBoundingClientRect();
  dragTo(preview().getByText(from), { x: b.left + 4, y: b.top + 2 }, { press: { x: a.left + 4, y: a.top + a.height / 2 } });
}

test('a row dropped in the live preview becomes the selection', () => {
  render(<Live />);
  drag('Dock', 'Show grid');
  expect(order()).not.toEqual(['grid', 'snap', 'dock']);
  expect(selectedRows().map(rowKey)).toEqual(['dock']);
});

test('with "Select what is dropped" off in the editor\'s preferences, the selection stays where it was', async () => {
  render(<Live />);
  fireEvent.click(screen.getByRole('button', { name: 'Preferences' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Schema editor preferences' })).getByRole('checkbox', { name: 'Select what is dropped' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Schema editor preferences' })).getByRole('button', { name: 'Close dialog' }));
  // The dialog leaves on its exit animation, which a loaded fleet node has taken over a second to finish.
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Schema editor preferences' })).toBeNull(), { timeout: 10_000 });
  fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('snap'));
  drag('Dock', 'Show grid');
  expect(order()).not.toEqual(['grid', 'snap', 'dock']);
  expect(selectedRows().map(rowKey)).toEqual(['snap']);
});
