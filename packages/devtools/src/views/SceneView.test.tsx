/** The Scene tab against a page the test plays, whose tree the test rearranges between reads. */
import { afterEach, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { DevtoolsArea, DevtoolsNodeSummary } from '../protocol';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import type { DevtoolsClient } from '../client';
import { SceneView } from './SceneView';

afterEach(cleanup);

const group = (id: string, childCount = 1): DevtoolsNodeSummary =>
  ({ id, kind: 'group', layer: 'main', childCount, hidden: false, locked: false, pickable: true });
const row = (name: string) => screen.getByRole('treeitem', { name: new RegExp(`^${name}\\b`) });

function fakePage(tree: Record<string, DevtoolsNodeSummary[]>) {
  const listeners = new Set<(rootId: string, areas: DevtoolsArea[]) => void>();
  const client = {
    onChanged: (l: (rootId: string, areas: DevtoolsArea[]) => void) => { listeners.add(l); return () => listeners.delete(l); },
    request: async (_root: string, m: { type: string; nodeId?: string }) =>
      (m.type === 'get-children' ? tree[m.nodeId ?? ''] ?? [] : null),
  } as unknown as DevtoolsClient;
  const changed = () => { for (const l of listeners) l('r', ['scene']); };
  return { client, changed };
}

it('draws each node once when a level it left behind still lists an ancestor', async () => {
  const tree: Record<string, DevtoolsNodeSummary[]> = { '': [group('B')], B: [group('A')], A: [group('X', 0)] };
  const page = fakePage(tree);
  renderWithIcons(<SceneView client={page.client} rootId="r" />);
  fireEvent.keyDown(await waitFor(() => row('B')), { key: 'ArrowRight' });
  fireEvent.keyDown(await waitFor(() => row('A')), { key: 'ArrowRight' });
  await waitFor(() => row('X'));
  fireEvent.keyDown(row('B'), { key: 'ArrowLeft' });
  tree[''] = [group('A')];
  tree.A = [group('B')];
  tree.B = [group('X', 0)];
  await act(async () => { page.changed(); await new Promise((r) => setTimeout(r, 0)); });
  fireEvent.keyDown(row('B'), { key: 'ArrowRight' });
  await waitFor(() => expect(row('X')).toBeTruthy());
  for (const id of ['A', 'B', 'X']) expect(screen.getAllByRole('treeitem', { name: new RegExp(`^${id}\\b`) })).toHaveLength(1);
});

it('draws a branch whose levels name each other in a loop without recursing forever', async () => {
  const tree: Record<string, DevtoolsNodeSummary[]> = { '': [group('B')], B: [group('A')], A: [group('B')] };
  const page = fakePage(tree);
  renderWithIcons(<SceneView client={page.client} rootId="r" />);
  fireEvent.keyDown(await waitFor(() => row('B')), { key: 'ArrowRight' });
  fireEvent.keyDown(await waitFor(() => row('A')), { key: 'ArrowRight' });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  expect(screen.getAllByRole('treeitem', { name: /^B\b/ })).toHaveLength(1);
});
