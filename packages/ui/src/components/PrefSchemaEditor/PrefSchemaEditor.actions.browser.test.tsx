import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { drag, grip, pointer } from './pointerDrag.fixture';

// A drag out of one tree and into another is hit-tested against real boxes.

afterEach(cleanup);

beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = '.editor-box { height: 700px; }';
  document.head.append(style);
});

const START: PrefGroup = {
  name: 'Prefs',
  children: {
    tools: { name: 'Tools', as: 'page', children: { grid: { kind: 'boolean', name: 'Show grid', description: '', default: true } } },
  },
};
const ACTIONS = [{ key: 'edit.undo', label: 'Undo' }, { key: 'edit.redo', label: 'Redo' }];

let latest: PrefGroup = START;
function Live() {
  const [schema, setSchema] = useState(START);
  latest = schema;
  return <div className="editor-box"><PrefSchemaEditor schema={schema} onChange={setSchema} actions={ACTIONS} /></div>;
}

const rowIn = (tree: string, key: string) =>
  within(screen.getByRole('tree', { name: tree })).getByText(key).closest('[role="treeitem"]')!.firstElementChild as HTMLElement;
const underTools = () => (latest.children.tools as PrefGroup).children;
const UNDO = { kind: 'action', name: 'Undo', description: '', default: undefined, action: 'edit.undo' };

test('an action dragged onto a group in the tree lands there as a pref that fires it, and stays listed', () => {
  render(<Live />);
  drag(rowIn('Actions', 'undo'), rowIn('Schema structure', 'tools'));
  expect(underTools().editUndo).toEqual(UNDO);
  expect(Object.keys(underTools())).toContain('grid');
  expect(within(screen.getByRole('tree', { name: 'Actions' })).getByText('undo')).toBeInTheDocument();
});

test('an action let go on a row the tree has not marked yet lands there', async () => {
  render(<Live />);
  const from = rowIn('Actions', 'undo');
  const onto = grip(rowIn('Schema structure', 'tools'));
  // One task, so React has drawn nothing of the move when the release comes.
  pointer('pointerdown', from, grip(from));
  pointer('pointermove', document, onto);
  pointer('pointerup', document, onto);
  await expect.poll(() => underTools().editUndo).toEqual(UNDO);
});
