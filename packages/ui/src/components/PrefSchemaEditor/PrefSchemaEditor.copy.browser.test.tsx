import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { drag } from './pointerDrag.fixture';

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

const row = (key: string) => within(screen.getByRole('tree', { name: 'Schema structure' })).getByText(`(${key})`).closest('[role="treeitem"]')!.firstElementChild as HTMLElement;

test('a row dragged onto another group with Alt held is copied there, and stays where it was', () => {
  render(<Live />);
  drag(row('grid'), row('panels'), { altKey: true });
  expect(Object.keys(latest.children)).toEqual(['view', 'panels']);
  expect(Object.keys((latest.children.view as PrefGroup).children)).toEqual(['grid']);
  expect(Object.keys((latest.children.panels as PrefGroup).children).sort()).toEqual(['dock', 'grid']);
  expect((latest.children.panels as PrefGroup).children.grid).toBe((START.children.view as PrefGroup).children.grid);
});

test('with Alt and Cmd held the drag sets an alias there, and the preview draws the one setting twice', () => {
  render(<Live />);
  drag(row('grid'), row('panels'), { altKey: true, metaKey: true });
  expect(Object.keys((latest.children.view as PrefGroup).children)).toEqual(['grid']);
  expect((latest.children.panels as PrefGroup).children.grid).toEqual({ kind: 'alias', name: '', description: '', default: undefined, of: 'view.grid' });
  expect(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('alias')).toBeInTheDocument();
});

test('a group cannot be aliased: the drag lands nothing', () => {
  render(<Live />);
  drag(row('view'), row('dock'), { altKey: true, metaKey: true });
  expect(latest).toBe(START);
});

test('the same drag without Alt moves it', () => {
  render(<Live />);
  drag(row('grid'), row('panels'));
  expect(Object.keys((latest.children.view as PrefGroup).children)).toEqual([]);
  expect(Object.keys((latest.children.panels as PrefGroup).children).sort()).toEqual(['dock', 'grid']);
});
