import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

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

const frame = () => new Promise((r) => requestAnimationFrame(r));
const preview = () => screen.getByRole('region', { name: 'Live preview' });
const cell = (key: string) => preview().querySelector(`[data-pref-path="${key}"]`) as HTMLElement;
const treeRow = (tree: string, key: string) =>
  within(screen.getByRole('tree', { name: tree })).getByText(`(${key})`).closest('[role="treeitem"]') as HTMLElement;

/** A point in `el`, `t` of the way along it. */
function along(el: HTMLElement, t: number) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width * t, y: r.top + r.height / 2 };
}

async function drag(from: HTMLElement, a: { x: number; y: number }, b: { x: number; y: number }) {
  const at = (p: { x: number; y: number }) => ({ bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: p.x, clientY: p.y, isPrimary: true });
  from.dispatchEvent(new PointerEvent('pointerdown', at(a)));
  for (let i = 1; i <= 8; i++) {
    document.dispatchEvent(new PointerEvent('pointermove', at({ x: a.x + ((b.x - a.x) * i) / 8, y: a.y + ((b.y - a.y) * i) / 8 })));
    await frame();
  }
  // Held still, so the answer is the one the settled layout gives.
  document.dispatchEvent(new PointerEvent('pointermove', at(b)));
  await frame();
  document.dispatchEvent(new PointerEvent('pointerup', at(b)));
  await frame();
}

test('an action dropped on the near half of a cell of a bar root lands before it', async () => {
  render(<Live />);
  const row = treeRow('Actions', 'view.snap').firstElementChild as HTMLElement;
  await drag(row, along(row, 0.2), along(cell('redo'), 0.25));
  expect(Object.keys(latest.children)).toEqual(['undo', 'viewSnap', 'redo', 'size']);
});

test('a button of a bar root dragged past the far half of the last cell lands after it', async () => {
  render(<Live />);
  const button = within(cell('undo')).getByRole('button');
  await drag(button, along(button, 0.5), along(cell('size'), 0.9));
  expect(Object.keys(latest.children)).toEqual(['redo', 'size', 'undo']);
});

test('a press on a cell of a bar root selects its pref in the tree', async () => {
  render(<Live />);
  const size = cell('size');
  const p = along(size, 0.1);
  size.firstElementChild!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, clientX: p.x, clientY: p.y }));
  document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: p.x, clientY: p.y }));
  await frame();
  expect(treeRow('Schema structure', 'size').getAttribute('aria-selected')).toBe('true');
  expect(size.hasAttribute('data-selected')).toBe(true);
});
