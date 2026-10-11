import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

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

const frame = () => new Promise((r) => requestAnimationFrame(r));
const rowIn = (tree: string, key: string) =>
  within(screen.getByRole('tree', { name: tree })).getByText(`(${key})`).closest('[role="treeitem"]')!.firstElementChild as HTMLElement;

async function drag(from: HTMLElement, to: HTMLElement) {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const [x0, y0, x1, y1] = [a.left + 40, a.top + a.height / 2, b.left + 40, b.top + b.height / 2];
  const at = (x: number, y: number) => ({ bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: y, isPrimary: true });
  from.dispatchEvent(new PointerEvent('pointerdown', at(x0, y0)));
  for (let i = 1; i <= 8; i++) {
    document.dispatchEvent(new PointerEvent('pointermove', at(x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8)));
    await frame();
  }
  document.dispatchEvent(new PointerEvent('pointerup', at(x1, y1)));
  await frame();
}

test('an action dragged onto a group in the tree lands there as a pref that fires it, and stays listed', async () => {
  render(<Live />);
  await drag(rowIn('Actions', 'edit.undo'), rowIn('Schema structure', 'tools'));
  const tools = (latest.children.tools as PrefGroup).children;
  expect(tools.editUndo).toEqual({ kind: 'action', name: 'Undo', description: '', default: undefined, action: 'edit.undo' });
  expect(Object.keys(tools)).toContain('grid');
  expect(within(screen.getByRole('tree', { name: 'Actions' })).getByText('(edit.undo)')).toBeInTheDocument();
});
