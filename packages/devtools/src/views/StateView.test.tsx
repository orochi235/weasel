/** The State tab's overlay switches against a page the test plays: one that keeps the flags it is sent. */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { DEBUG_FEATURES } from '@weasel-js/core';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import type { DevtoolsClient } from '../client';
import { StateView } from './StateView';

afterEach(cleanup);

function fakePage(on: readonly string[]) {
  const overlays: Record<string, boolean> = Object.fromEntries(DEBUG_FEATURES.map((f) => [f, on.includes(f)]));
  const sent: Record<string, boolean>[] = [];
  const client = {
    onChanged: () => () => {},
    request: async (_root: string, m: { type: string; overlays?: Record<string, boolean> }) => {
      if (m.type === 'set-overlays') {
        sent.push(m.overlays!);
        Object.assign(overlays, m.overlays);
        return null;
      }
      return { selection: [], view: {}, activeTool: null, tools: [], overlays: { ...overlays }, probes: {} };
    },
  } as unknown as DevtoolsClient;
  return { client, sent, overlays, on: () => DEBUG_FEATURES.filter((f) => overlays[f]) };
}

const flip = async (name: string, altKey = false): Promise<void> => {
  fireEvent.click(await screen.findByRole('switch', { name }), { altKey });
  await act(async () => {});
};

describe('<StateView> overlays', () => {
  it('turns on the flag a click flips, leaving the rest as they were', async () => {
    const page = fakePage(['bounds']);
    renderWithIcons(<StateView client={page.client} rootId="r" />);
    await flip('ids');
    expect(page.on()).toEqual(['bounds', 'ids']);
  });

  it('shows one overlay alone on Alt-click, and every overlay on a second', async () => {
    const page = fakePage(['bounds', 'fps']);
    renderWithIcons(<StateView client={page.client} rootId="r" />);
    await flip('handles', true);
    expect(page.on()).toEqual(['handles']);
    await flip('handles', true);
    expect(page.on()).toEqual([...DEBUG_FEATURES]);
  });

  it('sends each step of a sweep whole, though the page has not answered the one before', async () => {
    const page = fakePage([...DEBUG_FEATURES]);
    const request = page.client.request.bind(page.client);
    page.client.request = ((root: string, m: { type: string }) => (m.type === 'get-state' && page.sent.length > 0
      ? new Promise(() => {})
      : request(root, m as never))) as typeof page.client.request;
    renderWithIcons(<StateView client={page.client} rootId="r" />);
    await flip(DEBUG_FEATURES[0], true);
    await flip(DEBUG_FEATURES[1], true);
    expect(page.on()).toEqual([DEBUG_FEATURES[1]]);
  });

  it('shows an overlay the page turned on by other means, without a notice', async () => {
    const page = fakePage([]);
    renderWithIcons(<StateView client={page.client} rootId="r" />);
    const fps = await screen.findByRole('switch', { name: 'fps' });
    page.overlays.fps = true;
    await waitFor(() => expect((fps as HTMLInputElement).checked).toBe(true), { timeout: 2000 });
  });
});

it('shows a state read slower than the poll, rather than dropping each answer for the next request', async () => {
  let pending = 0;
  let most = 0;
  const client = {
    onChanged: () => () => {},
    request: (_root: string, m: { type: string }) => {
      if (m.type !== 'get-state') return Promise.resolve(null);
      most = Math.max(most, ++pending);
      return new Promise((resolve) => setTimeout(() => {
        pending--;
        resolve({ selection: ['slow'], view: {}, activeTool: null, tools: [], overlays: {}, probes: {} });
      }, 700));
    },
  } as unknown as DevtoolsClient;
  renderWithIcons(<StateView client={client} rootId="r" />);
  expect(await screen.findByText('slow', {}, { timeout: 3000 })).toBeTruthy();
  expect(most).toBe(1);
});
