import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { useState } from 'react';
import { isPrefLeaf, type PrefAlias, type PrefGroup } from '@weasel-js/prefs';
import { AssetEditor } from './AssetEditor';
import { DEMO_WORKSPACE } from './AssetEditor.demo';
import { drag } from './pointerDrag.fixture';
import type { Workspace } from './workspace';
import { workspaceCodec } from './workspaceCodec';
import { renderWithIcons } from '../../testing/withIcons';

// Whether a row dragged out of the settings tree lands in the layout is read off real boxes; jsdom lays nothing out.

beforeAll(() => page.viewport(1500, 800));
afterEach(cleanup);

const codec = workspaceCodec([]);
let latest: Workspace = DEMO_WORKSPACE;
function Live() {
  const [workspace, setWorkspace] = useState(DEMO_WORKSPACE);
  latest = workspace;
  return <div style={{ width: 1460, height: 700 }}><AssetEditor list workspace={workspace} codec={codec} onChange={setWorkspace} /></div>;
}

const option = (label: string) => within(screen.getByRole('listbox', { name: 'Assets' })).getByRole('option', { name: new RegExp(`^${label}`) });
const rowIn = (tree: string, key: string) =>
  within(screen.getByRole('tree', { name: tree })).getByText(key).closest('[role="treeitem"]')!.firstElementChild as HTMLElement;
const rootOf = (id: string) => latest.assets.find((a) => a.id === id)!.root as PrefGroup;
const pointers = (group: PrefGroup): Record<string, unknown> =>
  Object.fromEntries(Object.entries(group.children).map(([key, kid]) => [key, isPrefLeaf(kid) ? (kid as PrefAlias).of : pointers(kid as PrefGroup)]));

test('a setting dragged from the settings tree onto a heading of the layout lands in it as a pointer, in one step', () => {
  renderWithIcons(<Live />);
  fireEvent.click(option('Canvas'));
  const dialog = rootOf('settings');
  drag(rowIn('Settings', 'scale'), rowIn('Schema structure', 'lines'));
  expect(pointers(rootOf('canvas'))).toEqual({ zoomStep: 'view.zoomStep', lines: { grid: 'view.grid', snap: 'view.snap', scale: 'export.scale' } });
  expect(rootOf('settings')).toBe(dialog);
  expect(within(screen.getByRole('region', { name: 'Live preview' })).getByText('Scale')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(pointers(rootOf('canvas'))).toEqual({ zoomStep: 'view.zoomStep', lines: { grid: 'view.grid', snap: 'view.snap' } });
});

test('a group dragged from the settings tree lands as a heading over a pointer to each of its settings', () => {
  renderWithIcons(<Live />);
  fireEvent.click(option('Canvas'));
  drag(rowIn('Settings', 'export'), rowIn('Schema structure', 'zoomStep'));
  const canvas = pointers(rootOf('canvas'));
  expect(canvas.export).toEqual({ format: 'export.format', scale: 'export.scale' });
  expect((rootOf('canvas').children.export as PrefGroup).as).toBe('section');
});
