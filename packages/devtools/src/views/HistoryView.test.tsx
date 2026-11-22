/** The History tab against a page it does not have: a client whose slices the test writes. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { DevtoolsArea, DevtoolsHistoryRecord, DevtoolsHistorySlice } from '../protocol';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import type { DevtoolsClient } from '../client';
import { HistoryView } from './HistoryView';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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

  it('keeps a step read while the entries switch was flipped', async () => {
    const page = fakePage();
    let hold: Promise<void> | null = null;
    const request = page.client.request.bind(page.client);
    page.client.request = (async (...args: Parameters<typeof request>) => {
      const answer = request(...args);
      if (hold) await hold;
      return answer;
    }) as typeof request;
    renderWithIcons(<HistoryView client={page.client} rootId="r" />);
    await waitFor(() => expect(screen.getByRole('status', { name: 'Position' }).textContent).toBe('0 / 0'));

    let release!: () => void;
    hold = new Promise((r) => { release = r; });
    act(() => page.push(step('kit:held')));
    fireEvent.click(screen.getByRole('switch', { name: 'entries' }));
    hold = null;
    await act(async () => { release(); });
    expect(await screen.findByRole('cell', { name: 'push' })).toBeTruthy();
  });

  it("keeps counting a step's age between history notices", async () => {
    let clock = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const page = fakePage();
    renderWithIcons(<HistoryView client={page.client} rootId="r" />);
    act(() => page.push(step('kit:aged')));
    expect(await screen.findByRole('cell', { name: '0ms' })).toBeTruthy();
    clock = 6000;
    expect(await screen.findByRole('cell', { name: '5.0s' }, { timeout: 2000 })).toBeTruthy();
  });

  it('folds notices that arrive during a read into one read after it', async () => {
    const page = fakePage();
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    let asked = 0;
    const request = page.client.request.bind(page.client);
    page.client.request = (async (...args: Parameters<typeof request>) => {
      asked++;
      await held;
      return request(...args);
    }) as typeof request;
    renderWithIcons(<HistoryView client={page.client} rootId="r" />);
    await waitFor(() => expect(asked).toBe(1));
    for (let i = 0; i < 20; i++) act(() => page.push(step(`kit:${i}`)));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(asked).toBe(1);
    await act(async () => { release(); await new Promise((r) => setTimeout(r, 0)); });
    expect(asked).toBe(2);
    await waitFor(() => expect(screen.getByRole('status', { name: 'Position' }).textContent).toBe('20 / 20'));
  });

  it('keeps the open step open across a read that fails', async () => {
    const page = fakePage();
    renderWithIcons(<HistoryView client={page.client} rootId="r" />);
    act(() => page.push(step('kit:open')));
    fireEvent.click(await screen.findByRole('cell', { name: 'push' }));
    expect(await screen.findByText('kit:open')).toBeTruthy();
    page.client.request = (() => Promise.reject(new Error('lost the page'))) as DevtoolsClient['request'];
    act(() => page.push(step('kit:next')));
    expect((await screen.findByRole('alert')).textContent).toBe('lost the page');
    expect(screen.getByText('kit:open')).toBeTruthy();
  });

  it('reads again after a failed read, with no history notice to prompt it', async () => {
    const page = fakePage();
    const request = page.client.request.bind(page.client);
    let fail = true;
    page.client.request = ((...args: Parameters<typeof request>) =>
      fail ? Promise.reject(new Error('lost the page')) : request(...args)) as typeof request;
    renderWithIcons(<HistoryView client={page.client} rootId="r" />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fail = false;
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull(), { timeout: 2000 });
    expect(screen.getByRole('status', { name: 'Position' }).textContent).toBe('0 / 0');
  });

  it('names an unlabeled entry by its id the same way in its row, its detail, and the stacks', async () => {
    const page = fakePage();
    const request = page.client.request.bind(page.client);
    page.client.request = (async (...args: Parameters<typeof request>) => ({
      ...((await request(...args)) as DevtoolsHistorySlice),
      historyEntries: [{ id: 1, label: '' }],
    })) as typeof request;
    renderWithIcons(<HistoryView client={page.client} rootId="r" />);
    act(() => page.push(step('kit:unlabeled')));
    fireEvent.click(await screen.findByRole('cell', { name: 'push' }));
    fireEvent.click(screen.getByRole('switch', { name: 'entries' }));
    expect(screen.getByRole('cell', { name: '#1' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Entry #1' }).querySelector('h4')?.textContent).toMatch(/^#1/);
    expect((await screen.findByRole('list', { name: 'History entries' })).textContent).toBe('#1');
  });

  it('leaves the open step open when a step with nothing to show is clicked', async () => {
    const page = fakePage();
    renderWithIcons(<HistoryView client={page.client} rootId="r" />);
    act(() => page.push(step('kit:open')));
    act(() => page.push({ ...step('kit:none'), step: 'undo', entries: [] }));
    fireEvent.click(await screen.findByRole('cell', { name: 'push' }));
    expect(await screen.findByText('kit:open')).toBeTruthy();
    fireEvent.click(screen.getByRole('cell', { name: 'undo' }));
    expect(screen.getByText('kit:open')).toBeTruthy();
  });
});
