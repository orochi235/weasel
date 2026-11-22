/** The Frame tab against a page the test plays, whose fps overlay the test turns on behind the tab's back. */
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import type { DevtoolsClient } from '../client';
import { FrameView } from './FrameView';

afterEach(cleanup);

it('follows the fps overlay when the page turns it on by other means, without a notice', async () => {
  const overlays: Record<string, boolean> = { fps: false };
  const client = {
    onChanged: () => () => {},
    request: async (_root: string, m: { type: string }) => (m.type === 'get-frame'
      ? { paintMs: 1, drawCalls: 2, layers: [] }
      : { selection: [], view: {}, activeTool: null, tools: [], overlays: { ...overlays }, probes: {} }),
  } as unknown as DevtoolsClient;
  renderWithIcons(<FrameView client={client} rootId="r" />);
  expect(await screen.findByText(/measures its paints only while/)).toBeTruthy();
  overlays.fps = true;
  await waitFor(() => expect(screen.queryByText(/measures its paints only while/)).toBeNull(), { timeout: 2000 });
});

it('drops the last frame when the fps overlay turns off, rather than showing it as current when it turns on', async () => {
  const overlays: Record<string, boolean> = { fps: true };
  let frames: 'answer' | 'hold' = 'answer';
  const client = {
    onChanged: () => () => {},
    request: async (_root: string, m: { type: string; overlays?: { fps: boolean } }) => {
      if (m.type === 'set-overlays') { overlays.fps = m.overlays!.fps; return null; }
      if (m.type === 'get-frame') return frames === 'answer' ? { paintMs: 9.5, drawCalls: 2, layers: [] } : new Promise(() => {});
      return { selection: [], view: {}, activeTool: null, tools: [], overlays: { ...overlays }, probes: {} };
    },
  } as unknown as DevtoolsClient;
  renderWithIcons(<FrameView client={client} rootId="r" />);
  expect(await screen.findByText(/9\.50/)).toBeTruthy();
  frames = 'hold';
  fireEvent.click(screen.getByRole('switch', { name: 'fps overlay' }));
  await screen.findByText(/measures its paints only while/);
  fireEvent.click(screen.getByRole('switch', { name: 'fps overlay' }));
  expect(await screen.findByText('No paint measured yet.')).toBeTruthy();
  expect(screen.queryByText(/9\.50/)).toBeNull();
});

it("shows why the root's state could not be read, not the overlay note", async () => {
  const client = {
    onChanged: () => () => {},
    request: async () => { throw new Error('no canvas r'); },
  } as unknown as DevtoolsClient;
  renderWithIcons(<FrameView client={client} rootId="r" />);
  expect(await screen.findByText('no canvas r')).toBeTruthy();
  expect(screen.queryByText(/measures its paints only while/)).toBeNull();
});

it('keeps one frame read out at a time, so a slow answer never replaces a newer one', async () => {
  let calls = 0;
  let pending = 0;
  let most = 0;
  const client = {
    onChanged: () => () => {},
    request: (_root: string, m: { type: string }) => {
      if (m.type !== 'get-frame') {
        return Promise.resolve({ selection: [], view: {}, activeTool: null, tools: [], overlays: { fps: true }, probes: {} });
      }
      const paintMs = ++calls === 1 ? 1.11 : 2.22;
      most = Math.max(most, ++pending);
      return new Promise((resolve) => setTimeout(() => {
        pending--;
        resolve({ paintMs, drawCalls: 2, layers: [] });
      }, paintMs === 1.11 ? 1200 : 0));
    },
  } as unknown as DevtoolsClient;
  renderWithIcons(<FrameView client={client} rootId="r" />);
  expect(await screen.findByText(/2\.22/, {}, { timeout: 3000 })).toBeTruthy();
  await new Promise((r) => setTimeout(r, 700));
  expect(screen.queryByText(/1\.11/)).toBeNull();
  expect(most).toBe(1);
});
