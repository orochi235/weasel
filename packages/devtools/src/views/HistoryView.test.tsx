/** The History tab against a page it does not have: a client whose slices the test writes. */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { DevtoolsArea, DevtoolsHistoryRecord, DevtoolsHistorySlice } from '@weasel-js/core/devtools-protocol';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import type { DevtoolsClient } from '../client';
import { HistoryView } from './HistoryView';

afterEach(cleanup);

/** A step at one shared millisecond, as steps an app takes in one handler are. */
const step = (op: string): DevtoolsHistoryRecord => ({
  ts: 1000,
  step: 'push',
  entries: [{ id: 1, label: '', opCount: 1, ops: [{ kind: op, targets: [], summary: null }] }],
  position: { index: 1, total: 1 },
});

/** A client over a ring the test pushes to, announcing each push as a history change. */
function fakePage() {
  const ring: DevtoolsHistoryRecord[] = [];
  const listeners = new Set<(rootId: string, areas: DevtoolsArea[]) => void>();
  const client = {
    onChanged: (l: (rootId: string, areas: DevtoolsArea[]) => void) => { listeners.add(l); return () => listeners.delete(l); },
    request: async (_rootId: string, body: { cursor: number }): Promise<DevtoolsHistorySlice> => ({
      entries: ring.slice(body.cursor),
      cursor: ring.length,
      position: { index: ring.length, total: ring.length, canUndo: ring.length > 0, canRedo: false },
    }),
  } as unknown as DevtoolsClient;
  const push = (record: DevtoolsHistoryRecord) => {
    ring.push(record);
    for (const l of listeners) l('r', ['history']);
  };
  return { client, push };
}

describe('<HistoryView>', () => {
  it('opens only the step pressed, not a later one that takes its place in the list', async () => {
    const page = fakePage();
    renderWithIcons(<HistoryView client={page.client} rootId="r" />);
    act(() => page.push(step('kit:first')));
    fireEvent.click(await screen.findByRole('cell', { name: 'push' }));
    expect(await screen.findByText('kit:first')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    act(() => page.push(step('kit:second')));
    await screen.findByRole('cell', { name: 'push' });
    await waitFor(() => expect(screen.getByRole('status', { name: 'Position' }).textContent).toBe('2 / 2'));
    expect(screen.queryByText('kit:second')).toBeNull();
  });
});
