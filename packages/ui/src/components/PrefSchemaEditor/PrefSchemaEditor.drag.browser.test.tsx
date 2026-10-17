import '@weasel-js/theme/tokens.css';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { drag, pointIn } from './pointerDrag.fixture';
import { renderWithIcons } from '../../testing/withIcons';

// Laying a schema out by dragging: each way of picking a node up, carried by a pointer to a place read off real boxes.

// Wide enough that the live preview, the editor's last column, is on screen to be dropped on.
beforeAll(() => page.viewport(1600, 900));
afterEach(cleanup);

const leaf = (name: string) => ({ kind: 'boolean', name, description: '', default: false }) as const;
const START: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: { grid: leaf('Show grid'), snap: leaf('Snap'), zoom: leaf('Zoom') } },
    panels: { name: 'Panels', children: { dock: leaf('Dock') } },
  },
};

let latest: PrefGroup = START;
function Live() {
  const [schema, setSchema] = useState(START);
  latest = schema;
  return <div style={{ height: 600 }}><PrefSchemaEditor schema={schema} onChange={setSchema} /></div>;
}

const preview = () => screen.getByRole('region', { name: 'Live preview' });
const label = (name: string) => within(preview()).getByText(name);
const rail = (path: string) => preview().querySelector(`[data-pref-rail="${path}"]`) as HTMLElement;
const treeRow = (key: string) =>
  within(screen.getByRole('tree', { name: 'Schema structure' })).getByText(key).closest('[role="treeitem"]')!.firstElementChild as HTMLElement;
const tool = (name: string) => within(screen.getByRole('group', { name: 'Drag to add' })).getByRole('button', { name });
/** Each page's keys, in order. */
const layout = () => Object.fromEntries(Object.entries(latest.children).map(([key, group]) => [key, Object.keys((group as PrefGroup).children)]));

test('a palette tool dragged onto the top of a preview row adds its node before that row', () => {
  renderWithIcons(<Live />);
  drag(tool('Label'), pointIn(label('Snap'), 0.5, 0.1));
  expect(layout()).toEqual({ view: ['grid', 'label', 'snap', 'zoom'], panels: ['dock'] });
  expect((latest.children.view as PrefGroup).children.label).toMatchObject({ kind: 'label' });
});

test('a preview row dragged onto the top of another lands before it', () => {
  renderWithIcons(<Live />);
  drag(label('Zoom'), pointIn(label('Show grid'), 0.5, 0.1));
  expect(layout()).toEqual({ view: ['zoom', 'grid', 'snap'], panels: ['dock'] });
});

test('a preview row dragged onto another page\'s rail entry moves to the end of that page', () => {
  renderWithIcons(<Live />);
  drag(label('Show grid'), rail('panels'));
  expect(layout()).toEqual({ view: ['snap', 'zoom'], panels: ['dock', 'grid'] });
});

test('a tree row dragged onto the top of a sibling lands before it', () => {
  renderWithIcons(<Live />);
  drag(treeRow('zoom'), pointIn(treeRow('grid'), 0.5, 0.1));
  expect(layout()).toEqual({ view: ['zoom', 'grid', 'snap'], panels: ['dock'] });
});

test('a tree row dragged onto another group\'s row moves into that group', () => {
  renderWithIcons(<Live />);
  drag(treeRow('snap'), treeRow('panels'));
  expect(layout()).toEqual({ view: ['grid', 'zoom'], panels: ['dock', 'snap'] });
});
