/** The State tab's overlay switches against a page the test plays: one that keeps the flags it is sent. */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
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
  return { client, sent, on: () => DEBUG_FEATURES.filter((f) => overlays[f]) };
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
});
