import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefGroup } from '@weasel-js/prefs';
import { actionCatalog } from './actionCatalog';
import { Live, WORKSPACE } from './AssetEditor.fixture';
import { catalogOf, type Workspace } from './workspace';
import { drag } from './pointerDrag.fixture';

// A drag within the tree is hit-tested against real boxes.

afterEach(cleanup);

const ACTIONS = [{ key: 'edit.copy', label: 'Copy' }, { key: 'edit.paste', label: 'Paste' }, { key: 'save', label: 'Save' }];
const WITH_CATALOG: Workspace = {
  assets: [...WORKSPACE.assets, { id: 'actions', label: 'Actions', kind: 'actions', root: actionCatalog(ACTIONS) }],
};

const row = (label: string) =>
  within(screen.getByRole('tree', { name: 'Actions' })).getByText(label).closest('[role="treeitem"]')!.firstElementChild as HTMLElement;

async function live(start: Workspace) {
  let latest = start;
  await page.viewport(1500, 720);
  render(
    <div style={{ width: 1480, height: 700 }}>
      <Live start={start} actions={ACTIONS} onChange={(next) => { latest = next; }} />
    </div>,
  );
  return () => latest;
}

test('an action dragged onto a group of the catalog moves into it, and its row says its whole key there', async () => {
  const latest = await live(WITH_CATALOG);
  drag(row('Save'), row('Edit'));
  const catalog = catalogOf(latest())!.root as PrefGroup;
  expect(Object.keys(catalog.children)).toEqual(['edit']);
  expect(Object.keys((catalog.children.edit as PrefGroup).children)).toContain('save');
  // The group's actions no longer share `edit`, so no row leaves it out.
  expect(row('Copy')).toHaveTextContent('Copy edit.copy');
  expect(row('Save')).toHaveTextContent('Save save');
});

test('with no catalog in the workspace a drag within the list moves nothing', async () => {
  const latest = await live(WORKSPACE);
  drag(row('Save'), row('Edit'));
  expect(latest()).toBe(WORKSPACE);
  expect(row('Copy')).toHaveTextContent('Copy copy');
});
