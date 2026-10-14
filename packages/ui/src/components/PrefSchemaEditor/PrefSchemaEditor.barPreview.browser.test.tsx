import '@weasel-js/theme/tokens.css';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { drag, pointIn, pointer } from './pointerDrag.fixture';

// A drop on a bar is placed by which half of a cell the pointer is over, which needs real boxes.

afterEach(cleanup);

beforeAll(async () => {
  // Wide enough that the preview, the editor's last pane, is on screen to be hit-tested.
  await page.viewport(1600, 800);
  const style = document.createElement('style');
  style.textContent = '.editor-box { height: 700px; }';
  document.head.append(style);
});

const START: PrefGroup = {
  name: 'Tools',
  as: 'bar',
  children: {
    undo: { kind: 'action', name: 'Undo', description: '', default: undefined, action: 'edit.undo' },
    redo: { kind: 'action', name: 'Redo', description: '', default: undefined, action: 'edit.redo' },
    size: { kind: 'number', name: 'Size', description: '', default: 4 },
  },
};
const ACTIONS = [{ key: 'edit.undo', label: 'Undo' }, { key: 'edit.redo', label: 'Redo' }, { key: 'view.snap', label: 'Snap' }];

let latest: PrefGroup = START;
function Live() {
  const [schema, setSchema] = useState(START);
  latest = schema;
  return <div className="editor-box"><PrefSchemaEditor schema={schema} onChange={setSchema} actions={ACTIONS} /></div>;
}

const preview = () => screen.getByRole('region', { name: 'Live preview' });
const cell = (key: string) => preview().querySelector(`[data-pref-path="${key}"]`) as HTMLElement;
const treeRow = (tree: string, key: string) =>
  within(screen.getByRole('tree', { name: tree })).getByText(key).closest('[role="treeitem"]') as HTMLElement;

test('an action dropped on the near half of a cell of a bar root lands before it', () => {
  render(<Live />);
  const row = treeRow('Actions', 'snap').firstElementChild as HTMLElement;
  drag(row, pointIn(cell('redo'), 0.25), { press: pointIn(row, 0.2) });
  expect(Object.keys(latest.children)).toEqual(['undo', 'viewSnap', 'redo', 'size']);
});

test('a button of a bar root dragged past the far half of the last cell lands after it', () => {
  render(<Live />);
  const button = within(cell('undo')).getByRole('button');
  drag(button, pointIn(cell('size'), 0.9), { press: pointIn(button, 0.5) });
  expect(Object.keys(latest.children)).toEqual(['redo', 'size', 'undo']);
});

test('a press on a cell of a bar root selects its pref in the tree', () => {
  render(<Live />);
  const size = cell('size');
  const p = pointIn(size, 0.1);
  act(() => pointer('pointerdown', size.firstElementChild!, p));
  act(() => pointer('pointerup', document, p));
  expect(treeRow('Schema structure', 'size').getAttribute('aria-selected')).toBe('true');
  expect(size.hasAttribute('data-selected')).toBe(true);
});
