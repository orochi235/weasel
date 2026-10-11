import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

// Wide enough that the live preview, the editor's last column, is on screen to be pressed.
beforeAll(() => page.viewport(1600, 900));
afterEach(cleanup);

const START: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: {
      grid: { kind: 'boolean', name: 'Show grid', description: '', default: true },
      snap: { kind: 'boolean', name: 'Snap', description: '', default: false },
      zoom: { kind: 'boolean', name: 'Zoom', description: '', default: false },
    } },
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
const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const item = (key: string) => within(structure()).getByText(`(${key})`).closest('[role="treeitem"]') as HTMLElement;
const row = (key: string) => item(key).firstElementChild as HTMLElement;
const preview = () => screen.getByRole('region', { name: 'Live preview' });
const label = (name: string) => within(preview()).getByText(name);
const rail = (path: string) => preview().querySelector(`[data-pref-rail="${path}"]`) as HTMLElement;
const under = (key: string) => Object.keys((latest.children[key] as PrefGroup).children);
const selected = () => [...structure().querySelectorAll('[aria-selected="true"]')].map((el) => el.getAttribute('data-tree-id'));

const at = (x: number, y: number, more: PointerEventInit = {}) =>
  ({ bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: y, isPrimary: true, ...more });
const middle = (el: HTMLElement) => {
  const box = el.getBoundingClientRect();
  return [box.left + Math.min(40, box.width / 2), box.top + box.height / 2] as const;
};

async function drag(from: HTMLElement, to: HTMLElement) {
  const [x0, y0] = middle(from);
  const [x1, y1] = middle(to);
  from.dispatchEvent(new PointerEvent('pointerdown', at(x0, y0)));
  for (let i = 1; i <= 8; i++) {
    document.dispatchEvent(new PointerEvent('pointermove', at(x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8)));
    await frame();
  }
  document.dispatchEvent(new PointerEvent('pointerup', at(x1, y1)));
  await frame();
}

/** A press and a release in one place, as the pointer makes them. */
async function press(el: HTMLElement, more: PointerEventInit = {}) {
  const [x, y] = middle(el);
  el.dispatchEvent(new PointerEvent('pointerdown', at(x, y, more)));
  await frame();
  el.dispatchEvent(new PointerEvent('pointerup', at(x, y, more)));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y, ...more }));
  await frame();
}

const pickInTree = (...keys: string[]) => keys.forEach((key, i) => fireEvent.click(row(key), { metaKey: i > 0 }));

test('two rows selected in the tree drag to another group together, in their order', async () => {
  render(<Live />);
  pickInTree('snap', 'grid');
  await drag(row('grid'), row('panels'));
  expect(under('view')).toEqual(['zoom']);
  expect(under('panels').slice(-2)).toEqual(['grid', 'snap']);
  expect(selected().sort()).toEqual(['panels/grid', 'panels/snap']);
});

test('a Cmd press on a preview row adds it to the selection', async () => {
  render(<Live />);
  pickInTree('grid');
  await press(label('Snap'), { metaKey: true });
  expect(selected().sort()).toEqual(['view/grid', 'view/snap']);
  expect(within(screen.getByRole('region', { name: 'Attributes' })).getByText('2 selected')).toBeInTheDocument();
});

test('a press let go on one of several selected preview rows selects that row alone', async () => {
  render(<Live />);
  pickInTree('grid', 'snap');
  await press(label('Show grid'));
  expect(selected()).toEqual(['view/grid']);
});

test('one of several selected preview rows dragged onto a rail entry takes them all', async () => {
  render(<Live />);
  pickInTree('grid', 'snap');
  await drag(label('Show grid'), rail('panels'));
  expect(under('view')).toEqual(['zoom']);
  expect(under('panels')).toEqual(['dock', 'grid', 'snap']);
});

test('two rows selected in the tree drag onto the preview together', async () => {
  render(<Live />);
  pickInTree('grid', 'snap');
  await drag(row('grid'), rail('panels'));
  expect(under('view')).toEqual(['zoom']);
  expect(under('panels')).toEqual(['dock', 'grid', 'snap']);
});
