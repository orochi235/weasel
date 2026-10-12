import '@weasel-js/theme/tokens.css';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { drag, grip, pointer, pointIn, type Point } from './pointerDrag.fixture';

// The drags that end somewhere other than a preview row or a sibling: the Unplaced list, the tree from the
// palette, and a page a drag opens by resting on its rail entry.

beforeAll(() => page.viewport(1600, 900));
afterEach(cleanup);

const leaf = (name: string) => ({ kind: 'boolean', name, description: '', default: false }) as const;
const START: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: { grid: leaf('Show grid'), snap: leaf('Snap'), zoom: leaf('Zoom') } },
    panels: { name: 'Panels', children: { dock: leaf('Dock') } },
    loose: leaf('Loose'),
  },
};

let latest: PrefGroup = START;
function Live() {
  const [schema, setSchema] = useState(START);
  latest = schema;
  return <div style={{ height: 700 }}><PrefSchemaEditor schema={schema} onChange={setSchema} /></div>;
}

const preview = () => screen.getByRole('region', { name: 'Live preview' });
const label = (name: string) => within(preview()).getByText(name);
const rail = (path: string) => preview().querySelector(`[data-pref-rail="${path}"]`) as HTMLElement;
const treeRow = (key: string) =>
  within(screen.getByRole('tree', { name: 'Schema structure' })).getByText(`(${key})`).closest('[role="treeitem"]')!.firstElementChild as HTMLElement;
const tool = (name: string) => within(screen.getByRole('group', { name: 'Drag to add' })).getByRole('button', { name });
/** The list's box: the heading sits in its header, and the header in the box a drop lands on. */
const unplaced = () => screen.getByRole('heading', { name: 'Unplaced' }).parentElement!.parentElement!;
const keys = (group: PrefGroup) => Object.keys(group.children);

/** Press `from` and carry the pointer to `to`, holding it there. */
function carry(from: HTMLElement, to: Point): void {
  const press = grip(from);
  act(() => pointer('pointerdown', from, press));
  for (let i = 1; i <= 8; i++) act(() => pointer('pointermove', document, { x: press.x + ((to.x - press.x) * i) / 8, y: press.y + ((to.y - press.y) * i) / 8 }));
  act(() => pointer('pointermove', document, to));
}

test('a tree row dropped on the Unplaced list leaves its group for the root', () => {
  render(<Live />);
  drag(treeRow('grid'), pointIn(unplaced(), 0.5, 0.7));
  expect(keys(latest.children.view as PrefGroup)).toEqual(['snap', 'zoom']);
  expect(keys(latest)).toContain('grid');
});

test('a palette tool dropped on the top of a tree row adds its node before that row', () => {
  render(<Live />);
  drag(tool('Label'), pointIn(treeRow('snap'), 0.5, 0.1));
  expect(keys(latest.children.view as PrefGroup)).toEqual(['grid', 'label', 'snap', 'zoom']);
});

test('a drag held on a rail entry opens its page, and a row there can then be dropped beside', async () => {
  render(<Live />);
  carry(label('Show grid'), pointIn(rail('panels'), 0.5, 0.5));
  expect(within(preview()).queryByText('Dock')).toBeNull();
  await expect.poll(() => within(preview()).queryByText('Dock'), { timeout: 2000 }).not.toBeNull();
  const above = pointIn(label('Dock'), 0.5, 0.1);
  act(() => pointer('pointermove', document, above));
  act(() => pointer('pointermove', document, above));
  act(() => pointer('pointerup', document, above));
  expect(keys(latest.children.panels as PrefGroup)).toEqual(['grid', 'dock']);
  expect(keys(latest.children.view as PrefGroup)).toEqual(['snap', 'zoom']);
});
