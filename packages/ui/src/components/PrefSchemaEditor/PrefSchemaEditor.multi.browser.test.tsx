import '@weasel-js/theme/tokens.css';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { drag, grip, pointer } from './pointerDrag.fixture';

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

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const item = (key: string) => within(structure()).getByText(`(${key})`).closest('[role="treeitem"]') as HTMLElement;
const row = (key: string) => item(key).firstElementChild as HTMLElement;
const preview = () => screen.getByRole('region', { name: 'Live preview' });
const label = (name: string) => within(preview()).getByText(name);
const rail = (path: string) => preview().querySelector(`[data-pref-rail="${path}"]`) as HTMLElement;
const under = (key: string) => Object.keys((latest.children[key] as PrefGroup).children);
const selected = () => [...structure().querySelectorAll('[aria-selected="true"]')].map((el) => el.getAttribute('data-tree-id'));

/** A press and a release in one place, as the pointer makes them. */
function press(el: HTMLElement, keys: PointerEventInit = {}) {
  const at = grip(el);
  act(() => pointer('pointerdown', el, at, keys));
  act(() => {
    pointer('pointerup', el, at, keys);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: at.x, clientY: at.y, ...keys }));
  });
}

const pickInTree = (...keys: string[]) => keys.forEach((key, i) => fireEvent.click(row(key), { metaKey: i > 0 }));

test('two rows selected in the tree drag to another group together, in their order', () => {
  render(<Live />);
  pickInTree('snap', 'grid');
  drag(row('grid'), row('panels'));
  expect(under('view')).toEqual(['zoom']);
  expect(under('panels').slice(-2)).toEqual(['grid', 'snap']);
  expect(selected().sort()).toEqual(['panels/grid', 'panels/snap']);
});

test('a Cmd press on a preview row adds it to the selection', () => {
  render(<Live />);
  pickInTree('grid');
  press(label('Snap'), { metaKey: true });
  expect(selected().sort()).toEqual(['view/grid', 'view/snap']);
  expect(within(screen.getByRole('region', { name: 'Attributes' })).getByText('2 selected')).toBeInTheDocument();
});

test('a press let go on one of several selected preview rows selects that row alone', () => {
  render(<Live />);
  pickInTree('grid', 'snap');
  press(label('Show grid'));
  expect(selected()).toEqual(['view/grid']);
});

test('one of several selected preview rows dragged onto a rail entry takes them all', () => {
  render(<Live />);
  pickInTree('grid', 'snap');
  drag(label('Show grid'), rail('panels'));
  expect(under('view')).toEqual(['zoom']);
  expect(under('panels')).toEqual(['dock', 'grid', 'snap']);
});

test('two rows selected in the tree drag onto the preview together', () => {
  render(<Live />);
  pickInTree('grid', 'snap');
  drag(row('grid'), rail('panels'));
  expect(under('view')).toEqual(['zoom']);
  expect(under('panels')).toEqual(['dock', 'grid', 'snap']);
});
