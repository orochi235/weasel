import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

const START: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: { grid: { kind: 'boolean', name: 'Show grid', description: '', default: true } } },
    panels: { name: 'Panels', children: { dock: { kind: 'boolean', name: 'Dock', description: '', default: true } } },
  },
};

let latest: PrefGroup = START;
function Live() {
  const [schema, setSchema] = useState(START);
  latest = schema;
  return <div style={{ height: 600 }}><PrefSchemaEditor schema={schema} onChange={setSchema} /></div>;
}

const frame = () => new Promise((r) => requestAnimationFrame(r));
const row = (key: string) => within(screen.getByRole('tree', { name: 'Schema structure' })).getByText(`(${key})`).closest('[role="treeitem"]')!.firstElementChild as HTMLElement;

async function drag(from: HTMLElement, to: HTMLElement, altKey: boolean) {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const [x0, y0, x1, y1] = [a.left + 40, a.top + a.height / 2, b.left + 40, b.top + b.height / 2];
  const at = (x: number, y: number) => ({ bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: y, isPrimary: true, altKey });
  from.dispatchEvent(new PointerEvent('pointerdown', at(x0, y0)));
  for (let i = 1; i <= 8; i++) {
    document.dispatchEvent(new PointerEvent('pointermove', at(x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8)));
    await frame();
  }
  document.dispatchEvent(new PointerEvent('pointerup', at(x1, y1)));
  await frame();
}

test('a row dragged onto another group with Alt held is copied there, and stays where it was', async () => {
  render(<Live />);
  await drag(row('grid'), row('panels'), true);
  expect(Object.keys(latest.children)).toEqual(['view', 'panels']);
  expect(Object.keys((latest.children.view as PrefGroup).children)).toEqual(['grid']);
  expect(Object.keys((latest.children.panels as PrefGroup).children).sort()).toEqual(['dock', 'grid']);
  expect((latest.children.panels as PrefGroup).children.grid).toBe((START.children.view as PrefGroup).children.grid);
});

test('the same drag without Alt moves it', async () => {
  render(<Live />);
  await drag(row('grid'), row('panels'), false);
  expect(Object.keys((latest.children.view as PrefGroup).children)).toEqual([]);
  expect(Object.keys((latest.children.panels as PrefGroup).children).sort()).toEqual(['dock', 'grid']);
});
